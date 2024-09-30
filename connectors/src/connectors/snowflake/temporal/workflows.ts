import type { ModelId } from "@dust-tt/types";
import { proxyActivities, setHandler } from "@temporalio/workflow";

import type * as activities from "@connectors/connectors/snowflake/temporal/activities";
import { resyncSignal } from "@connectors/connectors/snowflake/temporal/signals";

const { syncSnowflakeConnection } = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minute",
});

export async function snowflakeSyncWorkflow({
  connectorId,
}: {
  connectorId: ModelId;
}) {
  let signaled = false;

  setHandler(resyncSignal, () => {
    signaled = true;
  });

  do {
    signaled = false;
    await syncSnowflakeConnection(connectorId);
  } while (signaled);
}
