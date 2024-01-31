import { runConfluenceWorker } from "@connectors/connectors/confluence/temporal/worker";
import { runWebCrawlerWorker } from "@connectors/connectors/webcrawler/temporal/worker";

import { runGithubWorker } from "./connectors/github/temporal/worker";
import { runGoogleWorker } from "./connectors/google_drive/temporal/worker";
import { runIntercomWorker } from "./connectors/intercom/temporal/worker";
import { runNotionWorker } from "./connectors/notion/temporal/worker";
import { runSlackWorker } from "./connectors/slack/temporal/worker";
import { errorFromAny } from "./lib/error";
import logger from "./logger/logger";

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ promise, reason, panic: true }, "Unhandled Rejection");
});

process.on("uncaughtException", (error) => {
  logger.error({ error, panic: true }, "Uncaught Exception");
});

runConfluenceWorker().catch((err) =>
  logger.error(errorFromAny(err), "Error running confluence worker")
);
runSlackWorker().catch((err) =>
  logger.error(errorFromAny(err), "Error running slack worker")
);
runNotionWorker().catch((err) =>
  logger.error(errorFromAny(err), "Error running notion worker")
);
runGithubWorker().catch((err) =>
  logger.error(errorFromAny(err), "Error running github worker")
);
runGoogleWorker().catch((err) =>
  logger.error(errorFromAny(err), "Error running google worker")
);
runIntercomWorker().catch((err) =>
  logger.error(errorFromAny(err), "Error running intercom worker")
);
runWebCrawlerWorker().catch((err) =>
  logger.error(errorFromAny(err), "Error running webcrawler worker")
);
