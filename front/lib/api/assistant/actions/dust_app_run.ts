import { Authenticator, prodAPICredentialsForOwner } from "@app/lib/auth";
import { extractConfig } from "@app/lib/config";
import { DustAPI } from "@app/lib/dust_api";
import { AgentDustAppRunAction } from "@app/lib/models";
import { Err, Ok, Result } from "@app/lib/result";
import logger from "@app/logger/logger";
import { AppType, SpecificationType } from "@app/types/app";
import {
  DustAppParameters,
  DustAppRunActionType,
  isDustAppRunConfiguration,
} from "@app/types/assistant/actions/dust_app_run";
import {
  AgentActionSpecification,
  AgentConfigurationType,
} from "@app/types/assistant/agent";
import {
  AgentMessageType,
  ConversationType,
  UserMessageType,
} from "@app/types/assistant/conversation";
import { DatasetSchema } from "@app/types/dataset";

import { getApp } from "../../app";
import { getDatasetSchema } from "../../datasets";
import { generateActionInputs } from "../agent";

/**
 * Params generation.
 */

export async function dustAppRunActionSpecification(
  app: AppType,
  schema: DatasetSchema | null
): Promise<Result<AgentActionSpecification, Error>> {
  const appName = app.name;
  const appDescription = app.description;

  // If we have no schema (aka no input block) there is no need to generate any input.
  if (!schema) {
    return new Ok({
      name: appName,
      description: appDescription || "",
      inputs: [],
    });
  }

  const inputs: {
    name: string;
    description: string;
    type: "string" | "number" | "boolean";
  }[] = [];

  for (const k of schema) {
    if (k.type === "json") {
      return new Err(
        new Error(
          `JSON type for Dust app parameters is not supported, string, number and boolean are.`
        )
      );
    }

    inputs.push({
      name: k.key,
      description: k.description || "",
      type: k.type,
    });
  }

  return new Ok({
    name: appName,
    description: appDescription || "",
    inputs,
  });
}

// Generates Dust app run parameters given the agent configuration and the conversation context.
export async function generateDustAppRunParams(
  auth: Authenticator,
  configuration: AgentConfigurationType,
  conversation: ConversationType,
  userMessage: UserMessageType,
  app: AppType,
  schema: DatasetSchema | null
): Promise<Result<DustAppParameters, Error>> {
  const c = configuration.action;
  if (!isDustAppRunConfiguration(c)) {
    throw new Error(
      "Unexpected action configuration received in `generateDustAppRunParams`"
    );
  }

  const specRes = await dustAppRunActionSpecification(app, schema);
  if (specRes.isErr()) {
    return new Err(specRes.error);
  }

  if (specRes.value.inputs.length > 0) {
    const now = Date.now();

    const rawInputsRes = await generateActionInputs(
      auth,
      configuration,
      specRes.value,
      conversation,
      userMessage
    );

    if (rawInputsRes.isOk()) {
      const rawInputs = rawInputsRes.value;
      // Check that all inputs are accounted for.

      logger.info(
        {
          elapsed: Date.now() - now,
        },
        "[ASSISTANT_TRACE] DustAppRun action inputs generation"
      );

      const inputs: DustAppParameters = {};

      for (const k of specRes.value.inputs) {
        if (rawInputs[k.name] && typeof rawInputs[k.name] === k.type) {
          inputs[k.name] = rawInputs[k.name];
        } else {
          return new Err(
            new Error(
              `Failed to generate input ${k.name} (expected type ${
                k.type
              }, got ${rawInputs[k.name]})`
            )
          );
        }
      }

      return new Ok(inputs);
    }
    logger.info(
      {
        elapsed: Date.now() - now,
        error: rawInputsRes.error,
      },
      "Error generating DustAppRun action inputs"
    );

    return new Err(rawInputsRes.error);
  }

  return new Ok({});
}

// Event sent during before the execution of a dust app run with the finalized params to be used.
export type DustAppRunParamsEvent = {
  type: "dust_app_run_params";
  created: number;
  configurationId: string;
  messageId: string;
  action: DustAppRunActionType;
};

export type DustAppRunErrorEvent = {
  type: "dust_app_run_error";
  created: number;
  configurationId: string;
  messageId: string;
  error: {
    code: string;
    message: string;
  };
};

export type DustAppRunBlockEvent = {
  type: "dust_app_run_block";
  created: number;
  configurationId: string;
  messageId: string;
  blockType: string;
  blockName: string;
};

export type DustAppRunSuccessEvent = {
  type: "dust_app_run_success";
  created: number;
  configurationId: string;
  messageId: string;
  action: DustAppRunActionType;
};

// This method is in charge of running a dust app and creating an AgentDustAppRunAction object in
// the database. It does not create any generic model related to the conversation. It is possible
// for an AgentDustAppRunAction to be stored (once the params are infered) but for the dust app run
// to fail, in which case an error event will be emitted and the AgentDustAppRunAction won't have
// any output associated. The error is expected to be stored by the caller on the parent agent
// message.
export async function* runDustApp(
  auth: Authenticator,
  configuration: AgentConfigurationType,
  conversation: ConversationType,
  userMessage: UserMessageType,
  agentMessage: AgentMessageType
): AsyncGenerator<
  | DustAppRunParamsEvent
  | DustAppRunBlockEvent
  | DustAppRunSuccessEvent
  | DustAppRunErrorEvent,
  void
> {
  const owner = auth.workspace();
  if (!owner) {
    throw new Error("Unexpected unauthenticated call to `runRetrieval`");
  }

  const c = configuration.action;
  if (!isDustAppRunConfiguration(c)) {
    throw new Error("Unexpected action configuration received in `runDustApp`");
  }

  if (owner.sId !== c.appWorkspaceId) {
    yield {
      type: "dust_app_run_error",
      created: Date.now(),
      configurationId: configuration.sId,
      messageId: agentMessage.sId,
      error: {
        code: "dust_app_run_workspace_error",
        message:
          "Runing Dust apps that are not part of your own workspace is not supported yet.",
      },
    };
    return;
  }

  const app = await getApp(auth, c.appId);
  if (!app) {
    yield {
      type: "dust_app_run_error",
      created: Date.now(),
      configurationId: configuration.sId,
      messageId: agentMessage.sId,
      error: {
        code: "dust_app_run_app_error",
        message: `Failed to retrieve Dust app ${c.appWorkspaceId}/${c.appId}`,
      },
    };
    return;
  }

  // Parse the specifiaction of the app.
  const appSpec = JSON.parse(
    app.savedSpecification || `[]`
  ) as SpecificationType;

  const appConfig = extractConfig(JSON.parse(app.savedSpecification || `{}`));

  let schema: DatasetSchema | null = null;

  const input = appSpec.find((b) => b.type === "input");
  if (input) {
    // We have an input block, we need to find associated dataset and its schema.
    const datasetName: string = appConfig.input?.dataset || "";
    schema = await getDatasetSchema(auth, app, datasetName);
    if (!schema) {
      yield {
        type: "dust_app_run_error",
        created: Date.now(),
        configurationId: configuration.sId,
        messageId: agentMessage.sId,
        error: {
          code: "dust_app_run_app_schema_error",
          message: `Failed to retrieve schema for dataset: ${c.appId}/${datasetName}`,
        },
      };
      return;
    }
  }

  const paramsRes = await generateDustAppRunParams(
    auth,
    configuration,
    conversation,
    userMessage,
    app,
    schema
  );

  if (paramsRes.isErr()) {
    yield {
      type: "dust_app_run_error",
      created: Date.now(),
      configurationId: configuration.sId,
      messageId: agentMessage.sId,
      error: {
        code: "dust_app_run_parameters_generation_error",
        message: `Error generating parameters for Dust App run: ${paramsRes.error.message}`,
      },
    };
    return;
  }

  const params = paramsRes.value;

  // Create the AgentDustAppRunAction object in the database and yield an event for the generation
  // of the params. We store the action here as the params have been generated, if an error occurs
  // later on, the action won't have an output but the error will be stored on the parent agent
  // message.
  const action = await AgentDustAppRunAction.create({
    dustAppRunConfigurationId: c.sId,
    appWorkspaceId: c.appWorkspaceId,
    appId: c.appId,
    appName: app.name,
    params,
  });

  yield {
    type: "dust_app_run_params",
    created: Date.now(),
    configurationId: configuration.sId,
    messageId: agentMessage.sId,
    action: {
      id: action.id,
      type: "dust_app_run_action",
      appWorkspaceId: c.appWorkspaceId,
      appId: c.appId,
      appName: app.name,
      params,
      output: null,
    },
  };

  // Let's run the app now.

  const prodCredentials = await prodAPICredentialsForOwner(owner);
  const api = new DustAPI(prodCredentials);

  const runRes = await api.runAppStreamed(
    {
      workspaceId: c.appWorkspaceId,
      appId: c.appId,
      appHash: "latest",
    },
    appConfig,
    [params]
  );

  if (runRes.isErr()) {
    yield {
      type: "dust_app_run_error",
      created: Date.now(),
      configurationId: configuration.sId,
      messageId: agentMessage.sId,
      error: {
        code: "dust_app_run_error",
        message: `Error running Dust app: ${runRes.error.message}`,
      },
    };
    return;
  }

  const { eventStream } = runRes.value;
  let lastBlockOutput: unknown | null = null;

  for await (const event of eventStream) {
    if (event.type === "error") {
      yield {
        type: "dust_app_run_error",
        created: Date.now(),
        configurationId: configuration.sId,
        messageId: agentMessage.sId,
        error: {
          code: "dust_app_run_error",
          message: `Error running Dust app: ${event.content.message}`,
        },
      };
      return;
    }

    if (event.type === "block_execution") {
      const e = event.content.execution[0][0];
      if (e.error) {
        yield {
          type: "dust_app_run_error",
          created: Date.now(),
          configurationId: configuration.sId,
          messageId: agentMessage.sId,
          error: {
            code: "dust_app_run_error",
            message: `Error running Dust app: ${e.error}`,
          },
        };
        return;
      }

      lastBlockOutput = e.value;

      yield {
        type: "dust_app_run_block",
        created: Date.now(),
        configurationId: configuration.sId,
        messageId: agentMessage.sId,
        blockType: event.content.block_type,
        blockName: event.content.block_name,
      };
    }
  }

  // Update DustAppRunAction with the output of the last block.
  await action.update({
    output: lastBlockOutput,
  });

  yield {
    type: "dust_app_run_success",
    created: Date.now(),
    configurationId: configuration.sId,
    messageId: agentMessage.sId,
    action: {
      id: action.id,
      type: "dust_app_run_action",
      appWorkspaceId: c.appWorkspaceId,
      appId: c.appId,
      appName: app.name,
      params,
      output: lastBlockOutput,
    },
  };
}
