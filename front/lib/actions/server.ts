import { DustProdActionRegistry } from "@app/lib/actions/registry";
import { prodAPICredentialsForOwner } from "@app/lib/auth";
import {
  DustAPI,
  DustAPIErrorResponse,
  DustAppConfigType,
  DustAppType,
} from "@app/lib/dust_api";
import { Err, Ok } from "@app/lib/result";
import logger from "@app/logger/logger";
import { statsDClient } from "@app/logger/withlogging";
import { WorkspaceType } from "@app/types/user";

// Record an event and a log for the action error.
const logActionError = (
  loggerArgs: {
    workspace: { sId: string; name: string };
    action: string;
    app: DustAppType;
  },
  tags: string[],
  errorType: string,
  errorArgs: Record<string, any>
) => {
  statsDClient.increment("use_actions_error.count", 1, [
    `error_type:${errorType}`,
    ...tags,
  ]);

  logger.error(
    {
      error_type: errorType,
      ...errorArgs,
      ...loggerArgs,
    },
    "Action run error"
  );
};

/**
 * This function is intended to be used server side to run an action. Logs and monitors the
 * execution and actions as well as any error happening while running the action.
 * @param owner WorkspaceType
 * @param actionName string Action name as per DustProdActionRegistry
 * @param config DustAppConfigType
 * @param inputs Array<any> the action inputs
 * @returns an eventStream and a dustRunId promise
 */
export async function runActionStreamed(
  owner: WorkspaceType,
  actionName: string,
  config: DustAppConfigType,
  inputs: Array<unknown>
) {
  if (!DustProdActionRegistry[actionName]) {
    return new Err({
      type: "action_unknown_error",
      message: `Unknown action: ${actionName}`,
    });
  }

  const action = DustProdActionRegistry[actionName];

  const loggerArgs = {
    workspace: {
      sId: owner.sId,
      name: owner.name,
    },
    action: actionName,
    app: action.app,
  };

  logger.info(loggerArgs, "Action run creation");

  const tags = [
    `action:${actionName}`,
    `workspace:${owner.sId}`,
    `workspace_name:${owner.name}`,
  ];

  statsDClient.increment("use_actions.count", 1, tags);

  const prodCredentials = await prodAPICredentialsForOwner(owner);
  const api = new DustAPI(prodCredentials);

  const res = await api.runAppStreamed(action.app, config, inputs);
  if (res.isErr()) {
    logActionError(loggerArgs, tags, "run_error", { error: res.error });
    return new Err(res.error);
  }

  const { eventStream, dustRunId } = res.value;

  const streamEvents = async function* () {
    for await (const event of eventStream) {
      if (event.type === "error") {
        logActionError(loggerArgs, tags, "run_error", { error: event.content });
      }
      if (event.type === "block_execution") {
        const e = event.content.execution[0][0];
        if (e.error) {
          logActionError(loggerArgs, tags, "block_execution_error", {
            error: e.error,
          });
        }
      }
      yield event;
    }
  };

  return new Ok({ eventStream: streamEvents(), dustRunId });
}

export async function runAction(
  owner: WorkspaceType,
  actionName: string,
  config: DustAppConfigType,
  inputs: Array<unknown>
) {
  if (!DustProdActionRegistry[actionName]) {
    return new Err({
      type: "action_unknown_error",
      message: `Unknown action: ${actionName}`,
    } as DustAPIErrorResponse);
  }

  const action = DustProdActionRegistry[actionName];

  const loggerArgs = {
    workspace: {
      sId: owner.sId,
      name: owner.name,
    },
    action: actionName,
    app: action.app,
  };

  logger.info(loggerArgs, "Action run creation");

  const tags = [
    `action:${actionName}`,
    `workspace:${owner.sId}`,
    `workspace_name:${owner.name}`,
  ];

  statsDClient.increment("use_actions.count", 1, tags);

  const prodCredentials = await prodAPICredentialsForOwner(owner);
  const api = new DustAPI(prodCredentials);

  const res = await api.runApp(action.app, config, inputs);
  if (res.isErr()) {
    logActionError(loggerArgs, tags, "run_error", { error: res.error });
    return new Err(res.error);
  }

  const run = res.value;

  run.traces.forEach((trace) => {
    trace[1].forEach((b) => {
      b.forEach((t) => {
        if (t.error) {
          logActionError(loggerArgs, tags, "block_execution_error", {
            error: t.error,
          });
        }
      });
    });
  });

  return new Ok(res.value);
}
