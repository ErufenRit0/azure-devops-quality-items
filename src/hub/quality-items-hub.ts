import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IProjectPageService } from "azure-devops-extension-api";
import { getClient } from "azure-devops-extension-api/Common";
import { WorkItemTrackingRestClient, WorkItem } from "azure-devops-extension-api/WorkItemTracking";
import { FIELDS, QUALITY_ITEM_TYPE_NAME } from "../common/fields";

function renderTable(items: WorkItem[]) {
  const root = document.getElementById("root")!;

  if (items.length === 0) {
    root.textContent = `No work items of type "${QUALITY_ITEM_TYPE_NAME}" found in this project yet.`;
    return;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr><th>ID</th><th>Title</th><th>State</th><th>Severity</th><th>Quality Category</th></tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");

  for (const item of items) {
    const row = document.createElement("tr");
    const fields = item.fields as Record<string, string>;
    row.innerHTML = `
      <td>${item.id}</td>
      <td>${fields["System.Title"] ?? ""}</td>
      <td>${fields["System.State"] ?? ""}</td>
      <td>${fields[FIELDS.Severity] ?? ""}</td>
      <td>${fields[FIELDS.QualityCategory] ?? ""}</td>
    `;
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  root.innerHTML = "";
  root.appendChild(table);
}

async function init() {
  await SDK.init({ loaded: false });

  const projectService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
  const project = await projectService.getProject();
  const client = getClient(WorkItemTrackingRestClient);

  const wiql = {
    query: `SELECT [System.Id], [System.Title], [System.State], [${FIELDS.Severity}], [${FIELDS.QualityCategory}]
            FROM WorkItems
            WHERE [System.TeamProject] = @project
              AND [System.WorkItemType] = '${QUALITY_ITEM_TYPE_NAME}'
            ORDER BY [${FIELDS.Severity}] ASC`,
  };

  const queryResult = await client.queryByWiql(wiql, project?.name);
  const ids = queryResult.workItems.map((w) => w.id);
  const items = ids.length > 0 ? await client.getWorkItems(ids, project?.name) : [];

  renderTable(items);
  SDK.notifyLoadSucceeded();
}

init().catch((error) => {
  const root = document.getElementById("root");
  if (root) {
    root.textContent = `Failed to load Quality Items: ${error instanceof Error ? error.message : String(error)}`;
  }
  // eslint-disable-next-line no-console
  console.error("Failed to initialize Quality Items hub", error);
});
