import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "@app/temporal/upsert_queue/activities";

const { upsertDocumentActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
});

const { upsertTableActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "20 minutes",
});

export async function upsertDocumentWorkflow(
  upsertQueueId: string,
  enqueueTimestamp: number
) {
  await upsertDocumentActivity(upsertQueueId, enqueueTimestamp);
}

// TODO(2024-10-02 flav) Removed once all the upsert tables have been processed from this queue.
export async function upsertTableWorkflow(
  upsertQueueId: string,
  enqueueTimestamp: number
) {
  await upsertTableActivity(upsertQueueId, enqueueTimestamp);
}
