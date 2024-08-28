import type { ModelId } from "@dust-tt/types";
import { assertNever } from "@temporalio/common/lib/type-helpers";
import {
  continueAsNew,
  executeChild,
  proxyActivities,
  setHandler,
  workflowInfo,
} from "@temporalio/workflow";

import type * as activities from "@connectors/connectors/google_drive/temporal/activities";
import type { FolderUpdatesSignal } from "@connectors/connectors/google_drive/temporal/signals";
import type * as sync_status from "@connectors/lib/sync_status";
import type { DataSourceConfig } from "@connectors/types/data_source_config";

import { GOOGLE_DRIVE_USER_SPACE_VIRTUAL_DRIVE_ID } from "../lib/consts";
import { folderUpdatesSignal } from "./signals";

const {
  getDrivesToSync,
  garbageCollector,
  getFoldersToSync,
  populateSyncTokens,
  garbageCollectorFinished,
  markFolderAsVisited,
  shouldGarbageCollect,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "20 minutes",
});

// Hotfix: increase timeout on incrementalSync to avoid restarting ongoing activities
const { incrementalSync } = proxyActivities<typeof activities>({
  startToCloseTimeout: "120 minutes",
  heartbeatTimeout: "5 minutes",
});

// Temporarily increase timeout on syncFiles until table upsertion is moved to the upsert queue.
const { syncFiles } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 minutes",
});

const { reportInitialSyncProgress, syncSucceeded } = proxyActivities<
  typeof sync_status
>({
  startToCloseTimeout: "10 minutes",
});

export async function googleDriveFullSync({
  connectorId,
  garbageCollect = true,
  foldersToBrowse = [],
  totalCount = 0,
  startSyncTs = undefined,
  mimeTypeFilter,
}: {
  connectorId: ModelId;
  garbageCollect: boolean;
  foldersToBrowse: string[];
  totalCount: number;
  startSyncTs: number | undefined;
  mimeTypeFilter?: string[];
}) {
  // Running the incremental sync workflow before the full sync to populate the
  // Google Drive sync tokens.
  await populateSyncTokens(connectorId);

  let nextPageToken: string | undefined = undefined;
  if (startSyncTs === undefined) {
    startSyncTs = new Date().getTime();
  }
  if (!foldersToBrowse) {
    foldersToBrowse = await getFoldersToSync(connectorId);
  }

  setHandler(folderUpdatesSignal, (folderUpdates: FolderUpdatesSignal[]) => {
    // If we get a signal, update the workflow state by adding/removing folder ids.
    for (const { action, folderId } of folderUpdates) {
      switch (action) {
        case "added":
          foldersToBrowse.push(folderId);
          break;
        case "removed":
          foldersToBrowse.splice(foldersToBrowse.indexOf(folderId), 1);
          break;
        default:
          assertNever(
            `Unexpected signal action ${action} received for Google Drive full sync workflow.`,
            action
          );
      }
    }
  });

  while (foldersToBrowse.length > 0) {
    const folder = foldersToBrowse.pop();
    if (!folder) {
      throw new Error("folderId should be defined");
    }
    do {
      const res = await syncFiles(
        connectorId,
        folder,
        startSyncTs,
        nextPageToken,
        mimeTypeFilter
      );
      nextPageToken = res.nextPageToken ? res.nextPageToken : undefined;
      totalCount += res.count;
      foldersToBrowse = foldersToBrowse.concat(res.subfolders);

      await reportInitialSyncProgress(
        connectorId,
        `Synced ${totalCount} files`
      );
    } while (nextPageToken);
    await markFolderAsVisited(connectorId, folder);
    if (workflowInfo().historyLength > 4000) {
      await continueAsNew<typeof googleDriveFullSync>({
        connectorId,
        garbageCollect,
        foldersToBrowse,
        totalCount,
        startSyncTs,
        mimeTypeFilter,
      });
    }
  }
  await syncSucceeded(connectorId);

  if (garbageCollect) {
    await executeChild(googleDriveGarbageCollectorWorkflow, {
      workflowId: googleDriveGarbageCollectorWorkflowId(connectorId),
      searchAttributes: {
        connectorId: [connectorId],
      },
      args: [connectorId, startSyncTs],
      memo: workflowInfo().memo,
    });
  }
}

export function googleDriveFullSyncWorkflowId(connectorId: ModelId) {
  return `googleDrive-fullSync-${connectorId}`;
}

export async function googleDriveIncrementalSync(
  connectorId: ModelId,
  dataSourceConfig: DataSourceConfig
) {
  const drives = await getDrivesToSync(connectorId);
  const startSyncTs = new Date().getTime();
  for (const googleDrive of drives) {
    let nextPageToken: undefined | string = undefined;
    do {
      nextPageToken = await incrementalSync(
        connectorId,
        dataSourceConfig,
        googleDrive.id,
        googleDrive.isSharedDrive,
        startSyncTs,
        nextPageToken
      );
    } while (nextPageToken);
  }
  // Run incremental sync for "userspace" (aka non shared drives, non "my drive").
  let nextPageToken: undefined | string = undefined;
  do {
    nextPageToken = await incrementalSync(
      connectorId,
      dataSourceConfig,
      GOOGLE_DRIVE_USER_SPACE_VIRTUAL_DRIVE_ID,
      false,
      startSyncTs,
      nextPageToken
    );
  } while (nextPageToken);
  const shouldGc = await shouldGarbageCollect(connectorId);
  if (shouldGc) {
    await executeChild(googleDriveGarbageCollectorWorkflow, {
      workflowId: googleDriveGarbageCollectorWorkflowId(connectorId),
      searchAttributes: {
        connectorId: [connectorId],
      },
      args: [connectorId, startSyncTs],
      memo: workflowInfo().memo,
    });
  }

  await syncSucceeded(connectorId);
}

export async function googleDriveGarbageCollectorWorkflow(
  connectorId: ModelId,
  gcMinTs: number
) {
  let processed = 0;
  do {
    processed = await garbageCollector(connectorId, gcMinTs);
  } while (processed > 0);

  await garbageCollectorFinished(connectorId);
}

export function googleDriveGarbageCollectorWorkflowId(connectorId: ModelId) {
  return `googleDrive-garbageCollector-${connectorId}`;
}
