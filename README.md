# Azure DevOps Quality Items

An open-source Azure DevOps extension that introduces **Quality Item** as a first-class work item type for tracking quality issues (defects, inconsistencies, improvement opportunities) alongside Bugs and Tasks - with structured classification (Severity, Quality Category, Root Cause) and optional AI-assisted classification.

> Status: early scaffold. Core pieces (manifest, work item type provisioning, form panel, hub, AI backend) are in place; the marketplace icon still needs to be replaced and everything needs testing against a real org before a real release. See "Before you publish" below.

## Features

- **Quality Item work item type** with three custom fields:
  - `Severity` - `1 - Critical` / `2 - High` / `3 - Medium` / `4 - Low`
  - `Quality Category` - `Functional` / `Performance` / `Security` / `Usability` / `Documentation` / `Compliance`
  - `Root Cause` - `Requirement Gap` / `Design Flaw` / `Code Defect` / `Test Gap` / `Process Issue` / `Environment/Infrastructure` / `Other`
- **Work item form panel** ("Quality Details") to view/edit these fields directly on the work item form.
- **Quality Items hub** - a backlog-style list of all Quality Items in the current project.
- **AI-assisted classification** (optional) - a "Suggest classification with AI" button that calls a small self-hosted backend ([`backend/`](backend/)), which calls the Claude API server-side to suggest a Quality Category, Root Cause and summary from the work item's title/description.

## Why there's no WIT XML file

Azure DevOps **Server** (on-premises) supports importing work item types via XML (the "XML process model"). Azure DevOps **Services** (cloud, what this extension targets) uses the **Inherited Process** model instead, which has no XML import - work item types and fields are created through the Process REST API (or the Organization Settings UI) instead.

This repo therefore ships:

- [`process/quality-item-work-item-type.json`](process/quality-item-work-item-type.json) - a declarative reference definition of the work item type, its fields and picklist values.
- [`scripts/provision-quality-item-type.ps1`](scripts/provision-quality-item-type.ps1) - a PowerShell script that reads that JSON and provisions the picklists, fields, states and work item type in your organization via REST API.

## Repository layout

```
vss-extension.json                        Extension manifest (publisher placeholder: YOUR-PUBLISHER-ID)
process/quality-item-work-item-type.json  Declarative WIT/field/picklist definition
scripts/provision-quality-item-type.ps1   Provisions the WIT in an Azure DevOps org via REST API
src/common/fields.ts                      Field reference names + picklist values (keep in sync with the JSON above)
src/common/ai-service.ts                  Client for the AI classification backend (see backend/)
src/form-group/                           "Quality Details" work item form panel contribution
src/hub/                                  "Quality Items" backlog hub contribution
backend/                                  Azure Function that proxies AI classification requests to the Claude API
.github/workflows/ci.yml                  Install, lint, build, package (.vsix) on every push/PR
```

## Getting started

### Prerequisites

- Node.js 20+
- An Azure DevOps Services organization with an **Inherited** process (Organization Settings > Process)
- A Personal Access Token with **Work Items** and **Process** (Read, write & manage) scope, for the provisioning script
- [tfx-cli](https://github.com/microsoft/tfs-cli) (installed automatically as a dev dependency; also runnable via `npx tfx-cli`)

### 1. Install and build

```bash
npm install
npm run build      # bundles src/ into dist/ via webpack
npm run lint
```

### 2. Provision the Quality Item work item type in your org

```bash
pwsh scripts/provision-quality-item-type.ps1 \
  -OrganizationUrl https://dev.azure.com/your-org \
  -ProcessName Agile \
  -PersonalAccessToken $env:AZURE_DEVOPS_PAT
```

The script prints the work item type's **reference name** (something like `Agile.QualityItem`) once done.

### 3. Point the extension at your work item type

Open `vss-extension.json` and replace the placeholder:

```jsonc
"workItemTypes": ["YOUR-PROCESS-NAME.QualityItem"]
```

with the reference name printed by the script.

### 4. Package

```bash
npm run package     # produces dist/quality-items.vsix
```

### 5. Install/share for testing, then publish

For day-to-day dev testing against a private org, see the companion private `quality-items-workspace` repository, which builds this repo and deploys the `.vsix` automatically via `tfx-cli` and a PAT stored as a GitHub secret.

To publish publicly:

```bash
npx tfx-cli extension publish --manifest-globs vss-extension.json --token <marketplace-PAT>
```

## Before you publish

- [ ] Replace `YOUR-PUBLISHER-ID` in `vss-extension.json` with your real [Marketplace publisher ID](https://marketplace.visualstudio.com/manage).
- [ ] Replace `YOUR-GITHUB-ORG` in `vss-extension.json`'s `repository`/`links` with your actual GitHub org/user.
- [ ] Replace `YOUR-PROCESS-NAME.QualityItem` with the real work item type reference name (step 3 above).
- [ ] Replace `images/extension-icon.png` with a real 128x128 PNG icon (it's currently a text placeholder so the packaging step has something to bundle).
- [ ] Set `"public": true` in `vss-extension.json` once you're ready for a public Marketplace listing.
- [ ] Deploy [`backend/`](backend/) and set `AI_BACKEND_URL` in `src/common/ai-service.ts` (or leave the AI feature disabled).

## AI-assisted classification: architecture note

The form panel's "Suggest classification with AI" button calls `classifyQualityItem()` in `src/common/ai-service.ts`, which does a `fetch` to a configurable `AI_BACKEND_URL`. **This extension never calls an LLM API directly from the browser** - that would leak your API key to every user who opens a work item.

[`backend/`](backend/) is that server-side piece: an Azure Function that accepts `{ title, description }`, calls the Claude API server-side with your API key (from an app setting, never committed), and returns `{ suggestedQualityCategory, suggestedRootCause, summary, confidence }`. See [`backend/README.md`](backend/README.md) for local dev and deployment instructions. It's a separate npm package from the extension (`backend/package.json`) since it deploys independently.

## Development

This project is developed with AI assistance (Claude Code). See the companion private `quality-items-workspace` repository for planning notes, architecture decisions and the dev-deploy pipeline.

## Contributing

Issues and pull requests are welcome. Please keep `src/common/fields.ts`, `backend/src/functions/classifyQualityItem.ts` and `process/quality-item-work-item-type.json` in sync if you change field names or picklist values.

## License

[MIT](LICENSE)
