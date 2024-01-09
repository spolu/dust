import { ModelId } from "@dust-tt/types";
import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "@connectors/connectors/confluence/temporal/activities";
import type * as sync_status from "@connectors/lib/sync_status";
import { DataSourceConfig } from "@connectors/types/data_source_config";

const { getSpaceIdsToSyncActivity, syncPagesForSpaceActivity } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: "20 minutes",
  });

const { reportInitialSyncProgress, syncSucceeded } = proxyActivities<
  typeof sync_status
>({
  startToCloseTimeout: "10 minutes",
});

export function getConfluenceFullSyncWorkflowId(connectorId: ModelId) {
  return `confluence-fullsync-${connectorId}`;
}

export async function confluenceFullSync(
  connectorId: ModelId,
  dataSourceConfig: DataSourceConfig,
  spaceIdsToBrowse: string[] | undefined = undefined
) {
  const spaceIdsToSync =
    spaceIdsToBrowse ?? (await getSpaceIdsToSyncActivity(connectorId));
  let totalCount = 0;

  for (const spaceId of spaceIdsToSync) {
    // Retrieve and loop through all pages for a given space.
    let nextPageCursor: string | null = "";
    do {
      const { count, nextPageCursor: next } = await syncPagesForSpaceActivity(
        connectorId,
        dataSourceConfig,
        spaceId,
        0,
        nextPageCursor
      );
      nextPageCursor = next; // Prepare for the next iteration.

      totalCount += count;

      await reportInitialSyncProgress(
        connectorId,
        `Synced ${totalCount} pages`
      );
    } while (nextPageCursor !== null);
  }

  await syncSucceeded(connectorId);

  console.log("confluenceFullSync done for connectorId", connectorId);
}
