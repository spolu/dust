import { runPostUpsertHooksWorker } from "@app/documents_post_process_hooks/temporal/worker";
import logger from "@app/logger/logger";
import { runPokeWorker } from "@app/poke/temporal/worker";
import { runProductionCheckWorker } from "@app/production_checks/temporal/worker";

runPostUpsertHooksWorker().catch((err) =>
  logger.error({ error: err }, "Error running post upsert hooks worker")
);
runPokeWorker().catch((err) =>
  logger.error({ error: err }, "Error running poke worker")
);

runProductionCheckWorker().catch((err) =>
  logger.error({ error: err }, "Error running production checks worker")
);
