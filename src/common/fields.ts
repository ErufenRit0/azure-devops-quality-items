export const QUALITY_ITEM_TYPE_NAME = "Quality Item";

// Keep these reference names and picklist values in sync with
// process/quality-item-work-item-type.json - that file is the source of
// truth consumed by scripts/provision-quality-item-type.ps1.
export const FIELDS = {
  Severity: "Custom.Severity",
  QualityCategory: "Custom.QualityCategory",
  RootCause: "Custom.RootCause",
} as const;

export const SEVERITY_VALUES = ["1 - Critical", "2 - High", "3 - Medium", "4 - Low"] as const;

export const QUALITY_CATEGORY_VALUES = [
  "Functional",
  "Performance",
  "Security",
  "Usability",
  "Documentation",
  "Compliance",
] as const;

export const ROOT_CAUSE_VALUES = [
  "Requirement Gap",
  "Design Flaw",
  "Code Defect",
  "Test Gap",
  "Process Issue",
  "Environment/Infrastructure",
  "Other",
] as const;
