import type { Context } from "@temporalio/activity";
import { Worker } from "@temporalio/worker";

import { MicrosoftCastKnownErrorsInterceptor } from "@connectors/connectors/microsoft/temporal/cast_known_errors";
import * as sync_status from "@connectors/lib/sync_status";
import {
  getTemporalWorkerConnection,
  TEMPORAL_MAXED_CACHED_WORKFLOWS,
} from "@connectors/lib/temporal";
import { ActivityInboundLogInterceptor } from "@connectors/lib/temporal_monitoring";
import logger from "@connectors/logger/logger";

import * as activities from "./activities";
import { QUEUE_NAME } from "./config";

export async function runMicrosoftWorker() {
  const { connection, namespace } = await getTemporalWorkerConnection();
  const workerFullSync = await Worker.create({
    workflowsPath: require.resolve("./workflows"),
    activities: { ...activities, ...sync_status },
    taskQueue: QUEUE_NAME,
    maxConcurrentActivityTaskExecutions: 15,
    connection,
    maxCachedWorkflows: TEMPORAL_MAXED_CACHED_WORKFLOWS,
    reuseV8Context: true,
    namespace,
    interceptors: {
      activityInbound: [
        (ctx: Context) => {
          return new ActivityInboundLogInterceptor(ctx, logger);
        },
        () => new MicrosoftCastKnownErrorsInterceptor(),
      ],
    },
  });

  await workerFullSync.run();
}
