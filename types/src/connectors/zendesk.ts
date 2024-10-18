import { ModelId } from "../shared/model_id";

export function getZendeskSyncWorkflowId(connectorId: ModelId) {
  return `zendesk-sync-${connectorId}`;
}
