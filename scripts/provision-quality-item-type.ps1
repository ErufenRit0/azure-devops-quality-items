<#
.SYNOPSIS
  Provisions the "Quality Item" work item type, its custom fields and
  picklists on an Inherited process in an Azure DevOps Services organization.

.DESCRIPTION
  Azure DevOps Services (cloud) has no XML process import like Azure DevOps
  Server. Instead this script drives the Inherited Process REST API to
  create the picklists, custom fields, states and the work item type itself,
  reading the definition from process/quality-item-work-item-type.json.

  The script is best-effort and intended to be run against a real test
  organization (see the private quality-items-workspace dev-deploy pipeline).
  Azure DevOps' Process REST API surface has shifted across API versions in
  the past - if a call fails, check the current REST API reference for the
  exact route/body shape and adjust here.

.PARAMETER OrganizationUrl
  Base URL of your Azure DevOps organization, e.g. https://dev.azure.com/contoso

.PARAMETER ProcessName
  Name of the Inherited process to extend, e.g. "Agile" (or your own custom
  inherited process, as shown under Organization Settings > Process).

.PARAMETER PersonalAccessToken
  A PAT with "Work Items (Read, write & manage)" and "Process (Read, write &
  manage)" scope. Pass via -PersonalAccessToken or the AZURE_DEVOPS_PAT env var.

.PARAMETER DefinitionPath
  Path to the JSON file describing the work item type and its fields.
  Defaults to process/quality-item-work-item-type.json next to this script.

.EXAMPLE
  ./provision-quality-item-type.ps1 -OrganizationUrl https://dev.azure.com/contoso -ProcessName Agile -PersonalAccessToken $env:AZURE_DEVOPS_PAT
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$OrganizationUrl,

    [Parameter(Mandatory = $true)]
    [string]$ProcessName,

    [Parameter(Mandatory = $false)]
    [string]$PersonalAccessToken = $env:AZURE_DEVOPS_PAT,

    [Parameter(Mandatory = $false)]
    [string]$DefinitionPath = (Join-Path $PSScriptRoot "../process/quality-item-work-item-type.json"),

    [Parameter(Mandatory = $false)]
    [string]$ApiVersion = "7.1"
)

if (-not $PersonalAccessToken) {
    throw "No PAT provided. Pass -PersonalAccessToken or set the AZURE_DEVOPS_PAT environment variable."
}

$OrganizationUrl = $OrganizationUrl.TrimEnd("/")
$authHeader = @{
    Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$PersonalAccessToken"))
}

function Invoke-Ado {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $false)]$Body,
        [Parameter(Mandatory = $false)][int[]]$IgnoreStatus = @()
    )
    try {
        $params = @{
            Method  = $Method
            Uri     = $Uri
            Headers = $authHeader
        }
        if ($Body) {
            $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
            $params["ContentType"] = "application/json"
        }
        return Invoke-RestMethod @params
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($IgnoreStatus -contains $status) {
            Write-Verbose "Ignoring status $status for $Uri"
            return $null
        }
        Write-Error "Request to $Uri failed (status $status): $($_.ErrorDetails.Message)"
        throw
    }
}

Write-Host "Loading work item type definition from $DefinitionPath"
$definition = Get-Content $DefinitionPath -Raw | ConvertFrom-Json

Write-Host "Looking up process '$ProcessName'..."
$processes = Invoke-Ado -Method GET -Uri "$OrganizationUrl/_apis/work/processes?api-version=$ApiVersion"
$process = $processes.value | Where-Object { $_.name -eq $ProcessName }
if (-not $process) {
    throw "Process '$ProcessName' not found. Note: only Inherited processes can be customized via API."
}
$processId = $process.typeId
Write-Host "Found process id $processId"

# 1. Create picklists + account-level custom fields
$fieldRefs = @()
foreach ($field in $definition.fields) {
    $picklistId = $null
    if ($field.picklist -and $field.picklist.Count -gt 0) {
        Write-Host "Creating picklist for field '$($field.name)'..."
        $picklistBody = @{
            name        = "$($field.name) list"
            type        = "String"
            items       = $field.picklist
            isSuggested = $false
        }
        $picklist = Invoke-Ado -Method POST -Uri "$OrganizationUrl/_apis/work/processes/lists?api-version=$ApiVersion-preview.1" -Body $picklistBody -IgnoreStatus @(409)
        $picklistId = $picklist.id
    }

    Write-Host "Creating field '$($field.referenceName)'..."
    $fieldBody = @{
        referenceName = $field.referenceName
        name          = $field.name
        type          = $field.type
        description   = "Managed by azure-devops-quality-items extension"
    }
    Invoke-Ado -Method POST -Uri "$OrganizationUrl/_apis/wit/fields?api-version=$ApiVersion" -Body $fieldBody -IgnoreStatus @(409, 400) | Out-Null

    $fieldRefs += [PSCustomObject]@{
        referenceName = $field.referenceName
        required      = [bool]$field.required
        defaultValue  = $field.defaultValue
        picklistId    = $picklistId
    }
}

# 2. Create the work item type on the process
Write-Host "Creating work item type '$($definition.name)' on process '$ProcessName'..."
$witBody = @{
    name        = $definition.name
    description = $definition.description
    color       = $definition.color
    icon        = $definition.icon
    isDisabled  = $false
}
$wit = Invoke-Ado -Method POST -Uri "$OrganizationUrl/_apis/work/processes/$processId/workitemtypes?api-version=$ApiVersion-preview.2" -Body $witBody -IgnoreStatus @(409)
if (-not $wit) {
    # already existed - look it up instead
    $existing = Invoke-Ado -Method GET -Uri "$OrganizationUrl/_apis/work/processes/$processId/workitemtypes?api-version=$ApiVersion-preview.2"
    $wit = $existing.value | Where-Object { $_.name -eq $definition.name }
}
$witRefName = $wit.referenceName
Write-Host "Work item type reference name: $witRefName"

# 3. Ensure states
foreach ($state in $definition.states) {
    Write-Host "Ensuring state '$($state.name)' ($($state.category))..."
    $stateBody = @{ name = $state.name; stateCategory = $state.category; color = "b2b2b2" }
    Invoke-Ado -Method POST -Uri "$OrganizationUrl/_apis/work/processes/$processId/workItemTypes/$witRefName/states?api-version=$ApiVersion-preview.1" -Body $stateBody -IgnoreStatus @(409) | Out-Null
}

# 4. Attach fields to the work item type
foreach ($f in $fieldRefs) {
    Write-Host "Adding field '$($f.referenceName)' to '$witRefName'..."
    $addBody = @{
        referenceName = $f.referenceName
        required      = $f.required
    }
    if ($f.defaultValue) { $addBody["defaultValue"] = $f.defaultValue }
    Invoke-Ado -Method POST -Uri "$OrganizationUrl/_apis/work/processes/$processId/workItemTypes/$witRefName/fields?api-version=$ApiVersion-preview.3" -Body $addBody -IgnoreStatus @(409) | Out-Null
}

Write-Host ""
Write-Host "Done. Next step: update vss-extension.json:" -ForegroundColor Green
Write-Host "  Replace 'YOUR-PROCESS-NAME.QualityItem' with '$witRefName' in the work-item-form-group contribution." -ForegroundColor Green
