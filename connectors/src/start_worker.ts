import type { ConnectorProvider } from "@dust-tt/types";
import { setupGlobalErrorHandler } from "@dust-tt/types";
import type { Options } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { runConfluenceWorker } from "@connectors/connectors/confluence/temporal/worker";
import { runWebCrawlerWorker } from "@connectors/connectors/webcrawler/temporal/worker";

import { runGithubWorker } from "./connectors/github/temporal/worker";
import { runGoogleWorker } from "./connectors/google_drive/temporal/worker";
import { runIntercomWorker } from "./connectors/intercom/temporal/worker";
import { runNotionWorker } from "./connectors/notion/temporal/worker";
import { runSlackWorker } from "./connectors/slack/temporal/worker";
import { errorFromAny } from "./lib/error";
import logger from "./logger/logger";

setupGlobalErrorHandler(logger);

const ALL_WORKERS: ConnectorProvider[] = [
  "confluence",
  "slack",
  "notion",
  "github",
  "google_drive",
  "intercom",
  "webcrawler",
];

async function runWorkers(workers: ConnectorProvider[]) {
  const workerFunctions: Record<ConnectorProvider, () => Promise<void>> = {
    confluence: runConfluenceWorker,
    github: runGithubWorker,
    google_drive: runGoogleWorker,
    intercom: runIntercomWorker,
    notion: runNotionWorker,
    slack: runSlackWorker,
    webcrawler: runWebCrawlerWorker,
  };

  for (const worker of workers) {
    workerFunctions[worker]().catch((err) =>
      logger.error(errorFromAny(err), `Error running ${worker} worker.`)
    );
  }
}

yargs(hideBin(process.argv))
  .option("workers", {
    alias: "w",
    type: "array",
    choices: ALL_WORKERS,
    default: ALL_WORKERS,
    demandOption: true,
    description: "Choose one or multiple workers to run.",
  })
  .help()
  .alias("help", "h")
  .parseAsync()
  .then(async (args) => runWorkers(args.workers as ConnectorProvider[]))
  .catch((err) => {
    logger.error(errorFromAny(err), "Error running workers");
    process.exit(1);
  });
