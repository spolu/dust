import type { ModelId } from "@dust-tt/types";
import {
  executeChild,
  proxyActivities,
  setHandler,
  workflowInfo,
} from "@temporalio/workflow";

import type * as activities from "@connectors/connectors/confluence/temporal/activities";
import type { SpaceUpdatesSignal } from "@connectors/connectors/confluence/temporal/signals";
import type { DataSourceConfig } from "@connectors/types/data_source_config";

// The Temporal bundle does not support the use of aliases in import statements.
import { spaceUpdatesSignal } from "./signals";
import { makeConfluenceSpaceSyncWorkflowIdFromParentId } from "./utils";

const {
  confluenceGetSpaceNameActivity,
  confluenceListPageIdsInSpaceActivity,
  confluenceSaveStartSyncActivity,
  confluenceUpsertPageActivity,
  confluenceSaveSuccessSyncActivity,

  fetchConfluenceConfigurationActivity,
  getSpaceIdsToSyncActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "20 minutes",
});

export async function confluenceFullSyncWorkflow({
  connectionId,
  connectorId,
  dataSourceConfig,
  spaceIdsToBrowse,
}: {
  connectionId: string;
  connectorId: ModelId;
  dataSourceConfig: DataSourceConfig;
  spaceIdsToBrowse?: string[];
}) {
  await confluenceSaveStartSyncActivity(connectorId);

  const spaceIdsToSync =
    spaceIdsToBrowse ?? (await getSpaceIdsToSyncActivity(connectorId));

  const uniqueSpaceIds = new Set(spaceIdsToSync);

  setHandler(spaceUpdatesSignal, (spaceUpdates: SpaceUpdatesSignal[]) => {
    for (const { action, spaceId } of spaceUpdates) {
      if (action === "added") {
        uniqueSpaceIds.add(spaceId);
      } else {
        uniqueSpaceIds.delete(spaceId);
      }
    }
  });

  const {
    workflowId,
    searchAttributes: parentSearchAttributes,
    memo,
  } = workflowInfo();

  for (const spaceId of uniqueSpaceIds) {
    await executeChild(confluenceSpaceSyncWorkflow, {
      workflowId: makeConfluenceSpaceSyncWorkflowIdFromParentId(
        workflowId,
        spaceId
      ),
      searchAttributes: parentSearchAttributes,
      args: [
        {
          connectionId,
          connectorId,
          dataSourceConfig,
          isBatchSync: true,
          spaceId,
        },
      ],
      memo,
    });
  }

  await confluenceSaveSuccessSyncActivity(connectorId);
}

interface ConfluenceSpaceSyncWorkflowInput {
  connectionId: string;
  connectorId: ModelId;
  dataSourceConfig: DataSourceConfig;
  isBatchSync: boolean;
  spaceId: string;
}

export async function confluenceSpaceSyncWorkflow(
  params: ConfluenceSpaceSyncWorkflowInput
) {
  const uniquePageIds = new Set<string>();

  const confluenceConfig = await fetchConfluenceConfigurationActivity(
    params.connectorId
  );

  const { cloudId: confluenceCloudId } = confluenceConfig;

  const spaceName = await confluenceGetSpaceNameActivity({
    ...params,
    confluenceCloudId: confluenceConfig?.cloudId,
  });

  // Retrieve and loop through all pages for a given space.
  let nextPageCursor: string | null = "";
  do {
    const { pageIds, nextPageCursor: nextCursor } =
      await confluenceListPageIdsInSpaceActivity({
        ...params,
        confluenceCloudId,
        pageCursor: nextPageCursor,
      });

    nextPageCursor = nextCursor; // Prepare for the next iteration.

    pageIds.forEach((id) => uniquePageIds.add(id));
  } while (nextPageCursor !== null);

  for (const pageId of uniquePageIds) {
    // TODO(2024-01-18 flav) Consider doing some parallel execution.
    await confluenceUpsertPageActivity({
      ...params,
      spaceName,
      pageId,
    });
  }

  return uniquePageIds.size;
}
