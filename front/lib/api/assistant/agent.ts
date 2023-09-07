import {
  cloneBaseConfig,
  DustProdActionRegistry,
} from "@app/lib/actions/registry";
import { runAction } from "@app/lib/actions/server";
import {
  RetrievalDocumentsEvent,
  RetrievalParamsEvent,
} from "@app/lib/api/assistant/actions/retrieval";
import {
  GenerationTokensEvent,
  renderConversationForModel,
} from "@app/lib/api/assistant/generation";
import { Authenticator } from "@app/lib/auth";
import { Err, Ok, Result } from "@app/lib/result";
import { generateModelSId } from "@app/lib/utils";
import {
  AgentActionConfigurationType,
  AgentActionSpecification,
  AgentConfigurationStatus,
  AgentConfigurationType,
  AgentGenerationConfigurationType,
} from "@app/types/assistant/agent";
import {
  AgentActionType,
  AgentMessageType,
  ConversationType,
  UserMessageType,
} from "@app/types/assistant/conversation";

/**
 * Agent configuration.
 */

export async function createAgentConfiguration(
  auth: Authenticator,
  {
    name,
    pictureUrl,
    action,
    generation,
  }: {
    name: string;
    pictureUrl?: string;
    action?: AgentActionConfigurationType;
    generation?: AgentGenerationConfigurationType;
  }
): Promise<AgentConfigurationType> {
  return {
    sId: generateModelSId(),
    name,
    pictureUrl: pictureUrl ?? null,
    status: "active",
    action: action ?? null,
    generation: generation ?? null,
  };
}

export async function updateAgentConfiguration(
  auth: Authenticator,
  configurationId: string,
  {
    name,
    pictureUrl,
    status,
    action,
    generation,
  }: {
    name: string;
    pictureUrl?: string;
    status: AgentConfigurationStatus;
    action?: AgentActionConfigurationType;
    generation?: AgentGenerationConfigurationType;
  }
): Promise<AgentConfigurationType> {
  return {
    sId: generateModelSId(),
    name,
    pictureUrl: pictureUrl ?? null,
    status,
    action: action ?? null,
    generation: generation ?? null,
  };
}

/**
 * Action Inputs generation.
 */

// This method is used by actions to generate its inputs if needed.
export async function generateActionInputs(
  auth: Authenticator,
  specification: AgentActionSpecification,
  conversation: ConversationType
): Promise<Result<Record<string, string | boolean | number>, Error>> {
  const model = {
    providerId: "openai",
    modelId: "gpt-3.5-turbo-16k",
  };
  const allowedTokenCount = 12288; // for 16k model.

  // Turn the conversation into a digest that can be presented to the model.
  const modelConversationRes = await renderConversationForModel({
    conversation,
    model,
    allowedTokenCount,
  });

  if (modelConversationRes.isErr()) {
    return modelConversationRes;
  }

  const config = cloneBaseConfig(
    DustProdActionRegistry["assistant-v2-inputs-generator"].config
  );
  config.MODEL.function_call = specification.name;
  config.MODEL.provider_id = model.providerId;
  config.MODEL.model_id = model.modelId;

  const res = await runAction(auth, "assistant-v2-inputs-generator", config, [
    {
      conversation: modelConversationRes.value,
      specification,
    },
  ]);

  if (res.isErr()) {
    return new Err(new Error(`Error generating action inputs: ${res.error}`));
  }

  const run = res.value;

  const output: Record<string, string | boolean | number> = {};
  for (const t of run.traces) {
    if (t[1][0][0].error) {
      return new Err(
        new Error(`Error generating action inputs: ${t[1][0][0].error}`)
      );
    }
    if (t[0][1] === "OUTPUT") {
      const v = t[1][0][0].value as any;
      for (const k in v) {
        if (
          typeof v[k] === "string" ||
          typeof v[k] === "boolean" ||
          typeof v[k] === "number"
        ) {
          output[k] = v[k];
        }
      }
    }
  }

  return new Ok(output);
}

/**
 * Agent execution.
 */

// Generic event sent when an error occured (whether it's during the action or the message generation).
export type AgentErrorEvent = {
  type: "agent_error";
  created: number;
  configurationId: string;
  messageId: string;
  error: {
    code: string;
    message: string;
  };
};

// Event sent durint the execution of an action. These are action specific.
export type AgentActionEvent = RetrievalParamsEvent | RetrievalDocumentsEvent;

// Event sent once the action is completed, we're moving to generating a message if applicable.
export type AgentActionSuccessEvent = {
  type: "agent_action_success";
  created: number;
  configurationId: string;
  messageId: string;
  action: AgentActionType;
};

// Event sent once the generation is completed.
export type AgentGenerationSuccessEvent = {
  type: "agent_generation_success";
  created: number;
  configurationId: string;
  messageId: string;
  text: string;
};

// Event sent once the message is completed and successful.
export type AgentMessageSuccessEvent = {
  type: "agent_message_success";
  created: number;
  configurationId: string;
  generationId: string;
  message: AgentMessageType;
};

// This interface is used to execute an agent. It is not in charge of creating the AgentMessage,
// nor updating it (responsability of the caller based on the emitted events).
export async function* runAgent(
  auth: Authenticator,
  configuration: AgentConfigurationType,
  conversation: ConversationType,
  userMessage: UserMessageType,
  agentMessage: AgentMessageType
): AsyncGenerator<
  | AgentErrorEvent
  | AgentActionEvent
  | AgentActionSuccessEvent
  | GenerationTokensEvent
  | AgentGenerationSuccessEvent
  | AgentMessageSuccessEvent
> {
  yield {
    type: "agent_error",
    created: Date.now(),
    configurationId: configuration.sId,
    messageId: generateModelSId(),
    error: {
      code: "not_implemented",
      message: "Not implemented",
    },
  };
}
