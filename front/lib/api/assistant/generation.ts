import type {
  AgentConfigurationType,
  AgentMessageType,
  ContentFragmentMessageTypeModel,
  ConversationType,
  GenerationCancelEvent,
  GenerationErrorEvent,
  GenerationSuccessEvent,
  GenerationTokensEvent,
  ModelConversationType,
  ModelConversationTypeMultiActions,
  ModelMessageType,
  ModelMessageTypeMultiActions,
  Result,
  UserMessageType,
} from "@dust-tt/types";
import {
  assertNever,
  cloneBaseConfig,
  DustProdActionRegistry,
  Err,
  isAgentMessageType,
  isBaseActionClass,
  isContentFragmentType,
  isRetrievalActionType,
  isRetrievalConfiguration,
  isUserMessageType,
  Ok,
  removeNulls,
} from "@dust-tt/types";
import moment from "moment-timezone";

import { runActionStreamed } from "@app/lib/actions/server";
import {
  retrievalMetaPrompt,
  retrievalMetaPromptMutiActions,
} from "@app/lib/api/assistant/actions/retrieval";
import { getAgentConfigurations } from "@app/lib/api/assistant/configuration";
import { getSupportedModelConfig, isLargeModel } from "@app/lib/assistant";
import type { Authenticator } from "@app/lib/auth";
import { getDeprecatedSingleAction } from "@app/lib/client/assistant_builder/deprecated_single_action";
import { deprecatedGetFirstActionConfiguration } from "@app/lib/deprecated_action_configurations";
import { redisClient } from "@app/lib/redis";
import { getContentFragmentText } from "@app/lib/resources/content_fragment_resource";
import { tokenCountForText, tokenSplit } from "@app/lib/tokenization";
import logger from "@app/logger/logger";

const CANCELLATION_CHECK_INTERVAL = 500;

/**
 * Model rendering of conversations.
 */

// This function transforms a conversation in a simplified format that we feed the model as context.
// It takes care of truncating the conversation all the way to `allowedTokenCount` tokens.
export async function renderConversationForModel({
  conversation,
  model,
  prompt,
  allowedTokenCount,
  excludeActions,
}: {
  conversation: ConversationType;
  model: { providerId: string; modelId: string };
  prompt: string;
  allowedTokenCount: number;
  excludeActions?: boolean;
}): Promise<
  Result<
    { modelConversation: ModelConversationType; tokensUsed: number },
    Error
  >
> {
  const messages: ModelMessageType[] = [];

  // We include the retrievals from the last agent message that involved retrievals only. This
  // allows to have multiple retrievals per agent messages (multi-actions) while not including old
  // retrievals from previous messages once one set of retrievals was included (existing behavior).
  let foundRetrieval = false;
  let includeRetrieval = true;

  // Render all messages and all actions.
  for (let i = conversation.content.length - 1; i >= 0; i--) {
    const versions = conversation.content[i];
    const m = versions[versions.length - 1];

    if (isAgentMessageType(m)) {
      if (m.content) {
        messages.unshift({
          role: "agent" as const,
          name: m.configuration.name,
          content: m.content,
        });
      }
      // There are contexts where we want to exclude the actions from the rendering.
      // Eg: During the conversation title generation step.
      const action = getDeprecatedSingleAction(m.actions);
      if (action && !excludeActions) {
        if (isBaseActionClass(action)) {
          if (isRetrievalActionType(action) && includeRetrieval) {
            foundRetrieval = true;
          }
          messages.unshift(action.renderForModel());
        } else {
          assertNever(action);
        }
      }
    } else if (isUserMessageType(m)) {
      if (foundRetrieval) {
        includeRetrieval = false;
      }

      // Replace all `:mention[{name}]{.*}` with `@name`.
      const content = m.content.replaceAll(
        /:mention\[([^\]]+)\]\{[^}]+\}/g,
        (_, name) => {
          return `@${name}`;
        }
      );
      messages.unshift({
        role: "user" as const,
        name: m.context.fullName || m.context.username,
        content,
      });
    } else if (isContentFragmentType(m)) {
      try {
        const content = await getContentFragmentText({
          workspaceId: conversation.owner.sId,
          conversationId: conversation.sId,
          messageId: m.sId,
        });
        messages.unshift({
          role: "content_fragment",
          name: `inject_${m.contentType}`,
          content:
            `TITLE: ${m.title}\n` +
            `TYPE: ${m.contentType}${
              m.contentType === "file_attachment" ? " (user provided)" : ""
            }\n` +
            `CONTENT:\n${content}`,
        });
      } catch (error) {
        logger.error(
          {
            error,
            workspaceId: conversation.owner.sId,
            conversationId: conversation.sId,
            messageId: m.sId,
          },
          "Failed to retrieve content fragment text"
        );
        return new Err(new Error("Failed to retrieve content fragment text"));
      }
    } else {
      ((x: never) => {
        throw new Error(`Unexpected message type: ${x}`);
      })(m);
    }
  }

  const now = Date.now();

  // Compute in parallel the token count for each message and the prompt.
  const [messagesCountRes, promptCountRes] = await Promise.all([
    // This is a bit aggressive but fuck it.
    Promise.all(
      messages.map((m) => {
        return tokenCountForText(`${m.role} ${m.name} ${m.content}`, model);
      })
    ),
    tokenCountForText(prompt, model),
  ]);

  if (promptCountRes.isErr()) {
    return new Err(promptCountRes.error);
  }

  // We initialize `tokensUsed` to the prompt tokens + a bit of buffer for message rendering
  // approximations, 64 tokens seems small enough and ample enough.
  const tokensMargin = 64;
  let tokensUsed = promptCountRes.value + tokensMargin;

  // Go backward and accumulate as much as we can within allowedTokenCount.
  const selected: ModelMessageType[] = [];
  const truncationMessage = `... (content truncated)`;
  const approxTruncMsgTokenCount = truncationMessage.length / 3;

  for (let i = messages.length - 1; i >= 0; i--) {
    const r = messagesCountRes[i];
    if (r.isErr()) {
      return new Err(r.error);
    }
    const c = r.value;
    if (tokensUsed + c <= allowedTokenCount) {
      tokensUsed += c;
      selected.unshift(messages[i]);
    } else if (
      // When a content fragment has more than the remaining number of tokens, we split it.
      messages[i].role === "content_fragment" &&
      // Allow at least tokensMargin tokens in addition to the truncation message.
      tokensUsed + approxTruncMsgTokenCount + tokensMargin < allowedTokenCount
    ) {
      const remainingTokens =
        allowedTokenCount - tokensUsed - approxTruncMsgTokenCount;
      const contentRes = await tokenSplit(
        messages[i].content,
        model,
        remainingTokens
      );
      if (contentRes.isErr()) {
        return new Err(contentRes.error);
      }
      selected.unshift({
        ...messages[i],
        content: contentRes.value + truncationMessage,
      });
      tokensUsed += remainingTokens;
      break;
    } else {
      break;
    }
  }

  logger.info(
    {
      workspaceId: conversation.owner.sId,
      conversationId: conversation.sId,
      messageCount: messages.length,
      promptToken: promptCountRes.value,
      tokensUsed,
      messageSelected: selected.length,
      elapsed: Date.now() - now,
    },
    "[ASSISTANT_TRACE] Genration message token counts for model conversation rendering"
  );
  while (selected.length > 0 && selected[0].role === "agent") {
    const tokenCountRes = messagesCountRes[messages.length - selected.length];
    if (tokenCountRes.isErr()) {
      return new Err(tokenCountRes.error);
    }
    tokensUsed -= tokenCountRes.value;
    selected.shift();
  }

  return new Ok({
    modelConversation: {
      messages: selected,
    },
    tokensUsed,
  });
}

export async function renderConversationForModelMultiActions({
  conversation,
  model,
  prompt,
  allowedTokenCount,
}: {
  conversation: ConversationType;
  model: { providerId: string; modelId: string };
  prompt: string;
  allowedTokenCount: number;
}): Promise<
  Result<
    {
      modelConversation: ModelConversationTypeMultiActions;
      tokensUsed: number;
    },
    Error
  >
> {
  const messages: ModelMessageTypeMultiActions[] = [];

  // Render all messages and all actions.
  for (let i = conversation.content.length - 1; i >= 0; i--) {
    const versions = conversation.content[i];
    const m = versions[versions.length - 1];

    if (isAgentMessageType(m)) {
      if (m.content) {
        messages.unshift({
          role: "assistant" as const,
          name: m.configuration.name,
          content: m.content,
        });
      }

      const actions = removeNulls(m.actions);
      const function_calls = [];
      const function_messages = [];

      for (const action of actions) {
        if (isBaseActionClass(action)) {
          function_messages.unshift(action.renderForMultiActionsModel());
          function_calls.unshift(action.renderForFunctionCall());
        } else {
          assertNever(action);
        }
      }

      if (function_messages.length > 0) {
        messages.unshift(...function_messages);
      }
      if (function_calls.length > 0) {
        messages.unshift({
          role: "assistant",
          function_calls,
        });
      }
    } else if (isUserMessageType(m)) {
      // Replace all `:mention[{name}]{.*}` with `@name`.
      const content = m.content.replaceAll(
        /:mention\[([^\]]+)\]\{[^}]+\}/g,
        (_, name) => {
          return `@${name}`;
        }
      );
      messages.unshift({
        role: "user" as const,
        name: m.context.fullName || m.context.username,
        content,
      });
    } else if (isContentFragmentType(m)) {
      try {
        const content = await getContentFragmentText({
          workspaceId: conversation.owner.sId,
          conversationId: conversation.sId,
          messageId: m.sId,
        });
        messages.unshift({
          role: "content_fragment",
          name: `inject_${m.contentType}`,
          content:
            `TITLE: ${m.title}\n` +
            `TYPE: ${m.contentType}${
              m.contentType === "file_attachment" ? " (user provided)" : ""
            }\n` +
            `CONTENT:\n${content}`,
        });
      } catch (error) {
        logger.error(
          {
            error,
            workspaceId: conversation.owner.sId,
            conversationId: conversation.sId,
            messageId: m.sId,
          },
          "Failed to retrieve content fragment text"
        );
        return new Err(new Error("Failed to retrieve content fragment text"));
      }
    } else {
      assertNever(m);
    }
  }

  // Compute in parallel the token count for each message and the prompt.
  const [messagesCountRes, promptCountRes] = await Promise.all([
    Promise.all(
      messages.map((m) => {
        let text = `${m.role} ${"name" in m ? m.name : ""} ${m.content ?? ""}`;
        if ("function_calls" in m) {
          text += m.function_calls
            .map((f) => `${f.name} ${f.arguments}`)
            .join(" ");
        }
        return tokenCountForText(text, model);
      })
    ),
    tokenCountForText(prompt, model),
  ]);

  if (promptCountRes.isErr()) {
    return new Err(promptCountRes.error);
  }

  // We initialize `tokensUsed` to the prompt tokens + a bit of buffer for message rendering
  // approximations, 64 tokens seems small enough and ample enough.
  const tokensMargin = 64;
  let tokensUsed = promptCountRes.value + tokensMargin;

  // Go backward and accumulate as much as we can within allowedTokenCount.
  const selected: ModelMessageTypeMultiActions[] = [];
  const truncationMessage = `... (content truncated)`;
  const approxTruncMsgTokenCount = truncationMessage.length / 3;

  for (let i = messages.length - 1; i >= 0; i--) {
    const r = messagesCountRes[i];
    if (r.isErr()) {
      return new Err(r.error);
    }
    const c = r.value;
    if (tokensUsed + c <= allowedTokenCount) {
      tokensUsed += c;
      selected.unshift(messages[i]);
    } else if (
      // When a content fragment has more than the remaining number of tokens, we split it.
      messages[i].role === "content_fragment" &&
      // Allow at least tokensMargin tokens in addition to the truncation message.
      tokensUsed + approxTruncMsgTokenCount + tokensMargin < allowedTokenCount
    ) {
      const msg = messages[i] as ContentFragmentMessageTypeModel;
      const remainingTokens =
        allowedTokenCount - tokensUsed - approxTruncMsgTokenCount;
      const contentRes = await tokenSplit(msg.content, model, remainingTokens);
      if (contentRes.isErr()) {
        return new Err(contentRes.error);
      }
      selected.unshift({
        ...msg,
        content: contentRes.value + truncationMessage,
      });
      tokensUsed += remainingTokens;
      break;
    } else {
      break;
    }
  }

  while (selected.length > 0 && selected[0].role === "assistant") {
    const tokenCountRes = messagesCountRes[messages.length - selected.length];
    if (tokenCountRes.isErr()) {
      return new Err(tokenCountRes.error);
    }
    tokensUsed -= tokenCountRes.value;
    selected.shift();
  }

  return new Ok({
    modelConversation: {
      messages: selected,
    },
    tokensUsed,
  });
}

/**
 * Generation execution.
 */

// Construct the full prompt from the agent configuration.
// - Meta data about the agent and current time.
// - Insructions from the agent configuration (in case of generation)
// - Meta data about the retrieval action (in case of retrieval)
export async function constructPrompt(
  auth: Authenticator,
  userMessage: UserMessageType,
  configuration: AgentConfigurationType,
  fallbackPrompt?: string
) {
  const d = moment(new Date()).tz(userMessage.context.timezone);
  const owner = auth.workspace();

  let context = "CONTEXT:\n";
  context += `{\n`;
  context += `  "assistant": "@${configuration.name}",\n`;
  context += `  "local_time": "${d.format("YYYY-MM-DD HH:mm (ddd)")}",\n`;
  if (owner) {
    context += `  "workspace": "${owner.name}",\n`;
  }
  context += "}\n";

  let instructions = "";
  if (configuration.instructions) {
    instructions += `\n${configuration.instructions}`;
  } else if (fallbackPrompt) {
    instructions += `\n${fallbackPrompt}`;
  }

  const actionConfig = deprecatedGetFirstActionConfiguration(configuration);

  if (isRetrievalConfiguration(actionConfig)) {
    instructions += `\n${retrievalMetaPrompt()}`;
  }
  if (instructions.length > 0) {
    instructions = "\nINSTRUCTIONS:" + instructions;
  }

  // Replacement if instructions include "{USER_FULL_NAME}".
  instructions = instructions.replaceAll(
    "{USER_FULL_NAME}",
    userMessage.context.fullName || "Unknown user"
  );

  // Replacement if instructions includes "{ASSISTANTS_LIST}"
  if (instructions.includes("{ASSISTANTS_LIST}")) {
    if (!auth.isUser()) {
      throw new Error("Unexpected unauthenticated call to `constructPrompt`");
    }
    const agents = await getAgentConfigurations({
      auth,
      agentsGetView: auth.user() ? "list" : "all",
      variant: "light",
    });
    instructions = instructions.replaceAll(
      "{ASSISTANTS_LIST}",
      agents
        .map((agent) => {
          let agentDescription = "";
          agentDescription += `@${agent.name}: `;
          agentDescription += `${agent.description}`;
          return agentDescription;
        })
        .join("\n")
    );
  }

  return `${context}${instructions}`;
}

export async function constructPromptMultiActions(
  auth: Authenticator,
  userMessage: UserMessageType,
  configuration: AgentConfigurationType,
  fallbackPrompt?: string
) {
  const d = moment(new Date()).tz(userMessage.context.timezone);
  const owner = auth.workspace();

  let context = "CONTEXT:\n";
  context += `{\n`;
  context += `  "assistant": "@${configuration.name}",\n`;
  context += `  "local_time": "${d.format("YYYY-MM-DD HH:mm (ddd)")}",\n`;
  if (owner) {
    context += `  "workspace": "${owner.name}",\n`;
  }
  context += "}\n";

  let instructions = "";
  if (configuration.instructions) {
    instructions += `\n${configuration.instructions}`;
  } else if (fallbackPrompt) {
    instructions += `\n${fallbackPrompt}`;
  }

  // If one of the action is a retrieval action, we add the retrieval meta prompt.
  const hasRetrievalAction = configuration.actions.some((action) =>
    isRetrievalConfiguration(action)
  );
  if (hasRetrievalAction) {
    instructions += `\n${retrievalMetaPromptMutiActions()}`;
  }

  if (instructions.length > 0) {
    instructions = "\nINSTRUCTIONS:" + instructions;
  }

  // Replacement if instructions include "{USER_FULL_NAME}".
  instructions = instructions.replaceAll(
    "{USER_FULL_NAME}",
    userMessage.context.fullName || "Unknown user"
  );

  // Replacement if instructions includes "{ASSISTANTS_LIST}"
  if (instructions.includes("{ASSISTANTS_LIST}")) {
    if (!auth.isUser()) {
      throw new Error("Unexpected unauthenticated call to `constructPrompt`");
    }
    const agents = await getAgentConfigurations({
      auth,
      agentsGetView: auth.user() ? "list" : "all",
      variant: "light",
    });
    instructions = instructions.replaceAll(
      "{ASSISTANTS_LIST}",
      agents
        .map((agent) => {
          let agentDescription = "";
          agentDescription += `@${agent.name}: `;
          agentDescription += `${agent.description}`;
          return agentDescription;
        })
        .join("\n")
    );
  }

  return `${context}${instructions}`;
}

// This function is in charge of running the generation of a message from the agent. It does not
// create any state, only stream tokens and/or error and final success events.
export async function* runGeneration(
  auth: Authenticator,
  configuration: AgentConfigurationType,
  conversation: ConversationType,
  userMessage: UserMessageType,
  agentMessage: AgentMessageType
): AsyncGenerator<
  | GenerationErrorEvent
  | GenerationTokensEvent
  | GenerationSuccessEvent
  | GenerationCancelEvent,
  void
> {
  const owner = auth.workspace();
  if (!owner) {
    throw new Error("Unexpected unauthenticated call to `runGeneration`");
  }

  const { model } = configuration;

  if (isLargeModel(model) && !auth.isUpgraded()) {
    yield {
      type: "generation_error",
      created: Date.now(),
      configurationId: configuration.sId,
      messageId: agentMessage.sId,
      error: {
        code: "free_plan_error",
        message: `Free plan does not support large models. Please upgrade to a paid plan to use this model.`,
      },
    };
    return;
  }

  const contextSize = getSupportedModelConfig(model).contextSize;

  const MIN_GENERATION_TOKENS = 2048;

  if (contextSize < MIN_GENERATION_TOKENS) {
    throw new Error(
      `Model contextSize unexpectedly small for model: ${model.providerId} ${model.modelId}`
    );
  }

  const prompt = await constructPrompt(auth, userMessage, configuration);

  // Turn the conversation into a digest that can be presented to the model.
  const modelConversationRes = await renderConversationForModel({
    conversation,
    model,
    prompt,
    allowedTokenCount: contextSize - MIN_GENERATION_TOKENS,
  });

  if (modelConversationRes.isErr()) {
    yield {
      type: "generation_error",
      created: Date.now(),
      configurationId: configuration.sId,
      messageId: agentMessage.sId,
      error: {
        code: "internal_server_error",
        message: `Failed tokenization for ${model.providerId} ${model.modelId}: ${modelConversationRes.error.message}`,
      },
    };
    return;
  }

  const config = cloneBaseConfig(
    DustProdActionRegistry["assistant-v2-generator"].config
  );
  config.MODEL.provider_id = model.providerId;
  config.MODEL.model_id = model.modelId;
  config.MODEL.temperature = model.temperature;

  // This is the console.log you want to uncomment to generate inputs for the generator app.
  // console.log(
  //   JSON.stringify({
  //     conversation: modelConversationRes.value,
  //     prompt,
  //   })
  // );

  logger.info(
    {
      workspaceId: conversation.owner.sId,
      conversationId: conversation.sId,
      providerId: model.providerId,
      modelId: model.modelId,
      temperature: model.temperature,
    },
    "[ASSISTANT_TRACE] Generation exection"
  );

  const res = await runActionStreamed(
    auth,
    "assistant-v2-generator",
    config,
    [
      {
        conversation: modelConversationRes.value.modelConversation,
        prompt,
      },
    ],
    {
      conversationId: conversation.sId,
      userMessageId: userMessage.sId,
      workspaceId: conversation.owner.sId,
    }
  );

  if (res.isErr()) {
    yield {
      type: "generation_error",
      created: Date.now(),
      configurationId: configuration.sId,
      messageId: agentMessage.sId,
      error: {
        code: "agent_generation_error",
        message: `Error generating agent message: [${res.error.type}] ${res.error.message}`,
      },
    };
    return;
  }

  const { eventStream } = res.value;

  let shouldYieldCancel = false;
  let lastCheckCancellation = Date.now();
  const redis = await redisClient();

  try {
    const _checkCancellation = async () => {
      try {
        const cancelled = await redis.get(
          `assistant:generation:cancelled:${agentMessage.sId}`
        );
        if (cancelled === "1") {
          shouldYieldCancel = true;
          await redis.set(
            `assistant:generation:cancelled:${agentMessage.sId}`,
            0,
            {
              EX: 3600, // 1 hour
            }
          );
        }
      } catch (error) {
        console.error("Error checking cancellation:", error);
        return false;
      }
    };

    for await (const event of eventStream) {
      if (event.type === "error") {
        yield {
          type: "generation_error",
          created: Date.now(),
          configurationId: configuration.sId,
          messageId: agentMessage.sId,
          error: {
            code: "agent_generation_error",
            message: `Error generating agent message: ${event.content.message}`,
          },
        };
        return;
      }

      const currentTimestamp = Date.now();
      if (
        currentTimestamp - lastCheckCancellation >=
        CANCELLATION_CHECK_INTERVAL
      ) {
        void _checkCancellation(); // Trigger the async function without awaiting
        lastCheckCancellation = currentTimestamp;
      }

      if (shouldYieldCancel) {
        yield {
          type: "generation_cancel",
          created: Date.now(),
          configurationId: configuration.sId,
          messageId: agentMessage.sId,
        };
        return;
      }

      if (event.type === "tokens") {
        yield {
          type: "generation_tokens",
          created: Date.now(),
          configurationId: configuration.sId,
          messageId: agentMessage.sId,
          text: event.content.tokens.text,
        };
      }

      if (event.type === "block_execution") {
        const e = event.content.execution[0][0];
        if (e.error) {
          yield {
            type: "generation_error",
            created: Date.now(),
            configurationId: configuration.sId,
            messageId: agentMessage.sId,
            error: {
              code: "agent_generation_error",
              message: `Error generating agent message: ${e.error}`,
            },
          };
          return;
        }

        if (event.content.block_name === "MODEL" && e.value) {
          const m = e.value as {
            message: {
              content: string;
            };
          };
          yield {
            type: "generation_success",
            created: Date.now(),
            configurationId: configuration.sId,
            messageId: agentMessage.sId,
            text: m.message.content,
          };
        }
      }
    }
  } finally {
    await redis.quit();
  }
}
