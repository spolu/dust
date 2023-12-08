import minimist from "minimist";

import { startServer } from "@connectors/api_server";

import { runGithubWorker } from "./connectors/github/temporal/worker";
import { runGoogleWorker } from "./connectors/google_drive/temporal/worker";
import { runNotionWorker } from "./connectors/notion/temporal/worker";
import { runSlackWorker } from "./connectors/slack/temporal/worker";
import { errorFromAny } from "./lib/error";
import logger from "./logger/logger";

const argv = minimist(process.argv.slice(2));
if (!argv.p) {
  throw new Error("Port is required: -p <port>");
}
const port = argv.p;

startServer(port);

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
  logger.error(errorFromAny(err), "Error running notion worker")
);

let startingMemoryUsage: any = null;
let i = 0;

setInterval(() => {
  if (i === 3) {
    startingMemoryUsage = process.memoryUsage();
    console.log("starting defined", new Date());
  }
  i++;
  if (startingMemoryUsage === null) {
    console.log("starting not defined", new Date());
    return;
  }
  const memoryUsage = process.memoryUsage();
  Object.entries(memoryUsage).forEach(([key, value]) => {
    const diff = value - startingMemoryUsage[key as keyof NodeJS.MemoryUsage];
    console.log(`${key}: ${diff / (1024 * 1024)} megabytes`);
  });
  console.log("----------------", new Date());
}, 5000);
