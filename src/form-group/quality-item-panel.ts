import * as SDK from "azure-devops-extension-sdk";
import { WorkItemTrackingServiceIds, IWorkItemFormService } from "azure-devops-extension-api/WorkItemTracking";
import { FIELDS, SEVERITY_VALUES, QUALITY_CATEGORY_VALUES, ROOT_CAUSE_VALUES } from "../common/fields";
import { classifyQualityItem } from "../common/ai-service";

function buildSelect(id: string, label: string, values: readonly string[]): HTMLElement {
  const row = document.createElement("div");
  row.className = "field-row";

  const labelEl = document.createElement("label");
  labelEl.setAttribute("for", id);
  labelEl.textContent = label;

  const select = document.createElement("select");
  select.id = id;

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "(none)";
  select.appendChild(emptyOption);

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }

  row.appendChild(labelEl);
  row.appendChild(select);
  return row;
}

async function init() {
  await SDK.init({ loaded: false });

  const root = document.getElementById("root")!;
  root.innerHTML = "";

  const severityRow = buildSelect("severity", "Severity", SEVERITY_VALUES);
  const categoryRow = buildSelect("quality-category", "Quality Category", QUALITY_CATEGORY_VALUES);
  const rootCauseRow = buildSelect("root-cause", "Root Cause", ROOT_CAUSE_VALUES);

  const aiButton = document.createElement("button");
  aiButton.textContent = "Suggest classification with AI";

  const aiStatus = document.createElement("div");
  aiStatus.id = "ai-status";

  root.appendChild(severityRow);
  root.appendChild(categoryRow);
  root.appendChild(rootCauseRow);
  root.appendChild(aiButton);
  root.appendChild(aiStatus);

  const formService = await SDK.getService<IWorkItemFormService>(WorkItemTrackingServiceIds.WorkItemFormService);

  const severitySelect = document.getElementById("severity") as HTMLSelectElement;
  const categorySelect = document.getElementById("quality-category") as HTMLSelectElement;
  const rootCauseSelect = document.getElementById("root-cause") as HTMLSelectElement;

  async function loadValues() {
    severitySelect.value = ((await formService.getFieldValue(FIELDS.Severity)) as string) || "";
    categorySelect.value = ((await formService.getFieldValue(FIELDS.QualityCategory)) as string) || "";
    rootCauseSelect.value = ((await formService.getFieldValue(FIELDS.RootCause)) as string) || "";
  }

  severitySelect.addEventListener("change", () => {
    void formService.setFieldValue(FIELDS.Severity, severitySelect.value);
  });
  categorySelect.addEventListener("change", () => {
    void formService.setFieldValue(FIELDS.QualityCategory, categorySelect.value);
  });
  rootCauseSelect.addEventListener("change", () => {
    void formService.setFieldValue(FIELDS.RootCause, rootCauseSelect.value);
  });

  aiButton.addEventListener("click", async () => {
    aiStatus.textContent = "Asking AI for a suggestion…";
    try {
      const title = ((await formService.getFieldValue("System.Title")) as string) || "";
      const description = ((await formService.getFieldValue("System.Description")) as string) || "";
      const result = await classifyQualityItem(title, description);

      if (ROOT_CAUSE_VALUES.includes(result.suggestedRootCause as (typeof ROOT_CAUSE_VALUES)[number])) {
        rootCauseSelect.value = result.suggestedRootCause;
        await formService.setFieldValue(FIELDS.RootCause, result.suggestedRootCause);
      }
      if (QUALITY_CATEGORY_VALUES.includes(result.suggestedQualityCategory as (typeof QUALITY_CATEGORY_VALUES)[number])) {
        categorySelect.value = result.suggestedQualityCategory;
        await formService.setFieldValue(FIELDS.QualityCategory, result.suggestedQualityCategory);
      }
      aiStatus.textContent = `AI suggestion applied (confidence ${Math.round(result.confidence * 100)}%). Review before saving.`;
    } catch (error) {
      aiStatus.textContent = error instanceof Error ? error.message : "AI suggestion failed.";
    }
  });

  // Note: IWorkItemFormService has no field-change event. Live re-sync across
  // form reloads (e.g. after Undo) would require registering a separate
  // ms.vss-work-web.work-item-notification-listener contribution; out of
  // scope for this scaffold, so values are loaded once on init.
  await loadValues();

  SDK.notifyLoadSucceeded();
}

init().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to initialize Quality Details panel", error);
});
