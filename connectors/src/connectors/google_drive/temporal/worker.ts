import type { Context } from "@temporalio/activity";
import { Worker } from "@temporalio/worker";

import * as activities from "@connectors/connectors/google_drive/temporal/activities";
import { GoogleDriveCastKnownErrorsInterceptor } from "@connectors/connectors/google_drive/temporal/cast_known_errors";
import * as sync_status from "@connectors/lib/sync_status";
import { getTemporalWorkerConnection } from "@connectors/lib/temporal";
import { ActivityInboundLogInterceptor } from "@connectors/lib/temporal_monitoring";
import logger from "@connectors/logger/logger";

import {
  GDRIVE_FULL_SYNC_QUEUE_NAME,
  GDRIVE_INCREMENTAL_SYNC_QUEUE_NAME,
} from "./config";

export async function runGoogleWorkers() {
  const { connection, namespace } = await getTemporalWorkerConnection();
  const workerFullSync = await Worker.create({
    workflowsPath: require.resolve("./workflows"),
    activities: { ...activities, ...sync_status },
    taskQueue: GDRIVE_FULL_SYNC_QUEUE_NAME,
    maxConcurrentActivityTaskExecutions: 10,
    connection,
    // We have 2 workers running on the same process, with 4096MB of memory each.
    maxCachedWorkflows: 292 / 2,
    reuseV8Context: true,
    namespace,
    interceptors: {
      activityInbound: [
        (ctx: Context) => {
          return new ActivityInboundLogInterceptor(ctx, logger);
        },
        () => new GoogleDriveCastKnownErrorsInterceptor(),
      ],
    },
  });

  const workerIncrementalSync = await Worker.create({
    workflowsPath: require.resolve("./workflows"),
    activities: { ...activities, ...sync_status },
    taskQueue: GDRIVE_INCREMENTAL_SYNC_QUEUE_NAME,
    maxConcurrentActivityTaskExecutions: 15,
    connection,
    // We have 2 workers running on the same process, with 4096MB of memory each.
    maxCachedWorkflows: 292 / 2,
    reuseV8Context: true,
    namespace,
    interceptors: {
      activityInbound: [
        (ctx: Context) => {
          return new ActivityInboundLogInterceptor(ctx, logger);
        },
        () => new GoogleDriveCastKnownErrorsInterceptor(),
      ],
    },
  });

  await Promise.all([workerFullSync.run(), workerIncrementalSync.run()]);
}
