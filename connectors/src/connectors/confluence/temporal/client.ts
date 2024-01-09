import { Err, ModelId, Ok, Result } from "@dust-tt/types";
import { WorkflowHandle, WorkflowNotFoundError } from "@temporalio/client";

import { QUEUE_NAME } from "@connectors/connectors/confluence/temporal/config";
import {
  confluenceFullSync,
  getConfluenceFullSyncWorkflowId,
} from "@connectors/connectors/confluence/temporal/workflows";
import { dataSourceConfigFromConnector } from "@connectors/lib/api/data_source_config";
import { Connector } from "@connectors/lib/models";
import { getTemporalClient } from "@connectors/lib/temporal";
import logger from "@connectors/logger/logger";

export async function launchConfluenceFullSyncWorkflow(
  connectorId: ModelId,
  fromTs: number | null
): Promise<Result<string, Error>> {
  const connector = await Connector.findByPk(connectorId);
  if (!connector) {
    return new Err(new Error(`Connector ${connectorId} not found`));
  }

  // TODO(2024-01-08 flavien) Support partial resync.
  if (fromTs) {
    return new Err(
      new Error("Confluence connector does not support partial resync")
    );
  }

  const client = await getTemporalClient();
  const connectorIdModelId = connectorId;

  const dataSourceConfig = dataSourceConfigFromConnector(connector);

  const workflowId = getConfluenceFullSyncWorkflowId(connectorId);
  try {
    const handle: WorkflowHandle<typeof confluenceFullSync> =
      client.workflow.getHandle(workflowId);
    try {
      await handle.terminate();
    } catch (e) {
      if (!(e instanceof WorkflowNotFoundError)) {
        throw e;
      }
    }
    await client.workflow.start(confluenceFullSync, {
      args: [connectorIdModelId, dataSourceConfig],
      taskQueue: QUEUE_NAME,
      workflowId: workflowId,

      memo: {
        connectorId: connectorId,
      },
    });
    logger.info(
      {
        workspaceId: dataSourceConfig.workspaceId,
        workflowId,
      },
      `Started workflow.`
    );
    return new Ok(workflowId);
  } catch (e) {
    logger.error(
      {
        workspaceId: dataSourceConfig.workspaceId,
        workflowId,
        error: e,
      },
      `Failed starting workflow.`
    );
    return new Err(e as Error);
  }
}
