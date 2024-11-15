import type {
  AssistantContentMessageTypeModel,
  AssistantFunctionCallMessageTypeModel,
  ConversationType,
  FunctionCallType,
  FunctionMessageTypeModel,
  ModelConfigurationType,
  ModelConversationTypeMultiActions,
  ModelMessageTypeMultiActions,
  Result,
} from "@dust-tt/types";
import {
  assertNever,
  Err,
  getTablesQueryResultsFileAttachment,
  isAgentMessageType,
  isContentFragmentMessageTypeModel,
  isContentFragmentType,
  isDevelopment,
  isTablesQueryActionType,
  isTextContent,
  isUserMessageType,
  Ok,
  removeNulls,
} from "@dust-tt/types";

import {
  getTextContentFromMessage,
  getTextRepresentationFromMessages,
} from "@app/lib/api/assistant/utils";
import type { Authenticator } from "@app/lib/auth";
import { getFeatureFlags } from "@app/lib/auth";
import { renderContentFragmentForModel } from "@app/lib/resources/content_fragment_resource";
import { tokenCountForTexts, tokenSplit } from "@app/lib/tokenization";
import logger from "@app/logger/logger";

export async function isJITActionsEnabled(
  auth: Authenticator
): Promise<boolean> {
  let use = false;
  if (isDevelopment()) {
    // For now we limit the feature flag to development only to not introduce an extraneous DB call
    // on the critical path of conversations.
    const flags = await getFeatureFlags(auth.getNonNullableWorkspace());
    if (flags.includes("conversations_jit_actions")) {
      use = true;
    }
  }
  return use;
}

/**
 * Model conversation rendering - JIT actions
 */

export async function renderConversationForModelJIT({
  conversation,
  model,
  prompt,
  allowedTokenCount,
  excludeActions,
  excludeImages,
  excludeContentFragments,
}: {
  conversation: ConversationType;
  model: ModelConfigurationType;
  prompt: string;
  allowedTokenCount: number;
  excludeActions?: boolean;
  excludeImages?: boolean;
  excludeContentFragments?: boolean;
}): Promise<
  Result<
    {
      modelConversation: ModelConversationTypeMultiActions;
      tokensUsed: number;
    },
    Error
  >
> {
  const now = Date.now();
  const messages: ModelMessageTypeMultiActions[] = [];

  // Render loop.
  // Render all messages and all actions.
  for (const versions of conversation.content) {
    const m = versions[versions.length - 1];

    if (isAgentMessageType(m)) {
      const actions = removeNulls(m.actions);
      // This array is 2D, because we can have multiple calls per agent message (parallel calls).

      const steps = [] as Array<{
        contents: string[];
        actions: Array<{
          call: FunctionCallType;
          result: FunctionMessageTypeModel;
        }>;
      }>;

      const emptyStep = () =>
        ({
          contents: [],
          actions: [],
        }) satisfies (typeof steps)[number];

      for (let stepIndex = 0; stepIndex < actions.length; stepIndex++) {
        const action = actions[stepIndex];
        steps[stepIndex] = steps[stepIndex] || emptyStep();
        steps[stepIndex].actions.push({
          call: action.renderForFunctionCall(),
          result: action.renderForMultiActionsModel(),
        });
      }

      for (const content of m.rawContents) {
        steps[content.step] = steps[content.step] || emptyStep();
        if (content.content.trim()) {
          steps[content.step].contents.push(content.content);
        }
      }

      if (excludeActions) {
        // In Exclude Actions mode, we only render the last step that has content.
        const stepsWithContent = steps.filter((s) => s?.contents.length);
        if (stepsWithContent.length) {
          const lastStepWithContent =
            stepsWithContent[stepsWithContent.length - 1];
          messages.push({
            role: "assistant",
            name: m.configuration.name,
            content: lastStepWithContent.contents.join("\n"),
          } satisfies AssistantContentMessageTypeModel);
        }
      } else {
        // In regular mode, we render all steps.
        for (const step of steps) {
          if (!step) {
            logger.error(
              {
                workspaceId: conversation.owner.sId,
                conversationId: conversation.sId,
                agentMessageId: m.sId,
                panic: true,
              },
              "Unexpected state, agent message step is empty"
            );
            continue;
          }
          if (!step.actions.length && !step.contents.length) {
            logger.error(
              {
                workspaceId: conversation.owner.sId,
                conversationId: conversation.sId,
                agentMessageId: m.sId,
              },
              "Unexpected state, agent message step with no actions and no contents"
            );
            continue;
          }

          if (step.actions.length) {
            messages.push({
              role: "assistant",
              function_calls: step.actions.map((s) => s.call),
              content: step.contents.join("\n"),
            } satisfies AssistantFunctionCallMessageTypeModel);
          } else {
            messages.push({
              role: "assistant",
              content: step.contents.join("\n"),
              name: m.configuration.name,
            } satisfies AssistantContentMessageTypeModel);
          }

          for (const { result } of step.actions) {
            messages.push(result);
          }
        }
      }

      if (!m.rawContents.length && m.content?.trim()) {
        // We need to maintain support for legacy agent messages that don't have rawContents.
        messages.push({
          role: "assistant",
          name: m.configuration.name,
          content: m.content,
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
      messages.push({
        role: "user" as const,
        name: m.context.fullName || m.context.username,
        content: [
          {
            type: "text",
            text: content,
          },
        ],
      });
    } else if (isContentFragmentType(m)) {
      const res = await renderContentFragmentForModel(m, conversation, model, {
        excludeImages: Boolean(excludeImages),
      });

      if (res.isErr()) {
        return new Err(res.error);
      }
      if (!excludeContentFragments) {
        messages.push(res.value);
      }
    } else {
      assertNever(m);
    }
  }

  // If we have messages...
  if (messages.length > 0) {
    const { filesAsXML, hasFiles } = listConversationFiles({
      conversation,
    });

    // ... and files, we simulate a function call to list the files at the end of the conversation.
    if (hasFiles) {
      const randomCallId = "tool_" + Math.random().toString(36).substring(7);
      const functionName = "list_conversation_files";

      const simulatedAgentMessages = [
        // 1. We add a message from the agent, asking to use the files listing function
        {
          role: "assistant",
          function_calls: [
            {
              id: randomCallId,
              name: functionName,
              arguments: "{}",
            },
          ],
        } as AssistantFunctionCallMessageTypeModel,

        // 2. We add a message with the resulting files listing
        {
          function_call_id: randomCallId,
          role: "function",
          name: functionName,
          content: filesAsXML,
        } as FunctionMessageTypeModel,
      ];

      // Append the simulated messages to the end of the conversation.
      messages.push(...simulatedAgentMessages);
    }
  }

  // Compute in parallel the token count for each message and the prompt.
  const res = await tokenCountForTexts(
    [prompt, ...getTextRepresentationFromMessages(messages)],
    model
  );

  if (res.isErr()) {
    return new Err(res.error);
  }

  const [promptCount, ...messagesCount] = res.value;

  // We initialize `tokensUsed` to the prompt tokens + a bit of buffer for message rendering
  // approximations, 64 tokens seems small enough and ample enough.
  const tokensMargin = 1024;
  let tokensUsed = promptCount + tokensMargin;

  // Go backward and accumulate as much as we can within allowedTokenCount.
  const selected: ModelMessageTypeMultiActions[] = [];
  const truncationMessage = `... (content truncated)`;
  const approxTruncMsgTokenCount = truncationMessage.length / 3;

  // Selection loop.
  for (let i = messages.length - 1; i >= 0; i--) {
    const c = messagesCount[i];

    const currentMessage = messages[i];

    if (tokensUsed + c <= allowedTokenCount) {
      tokensUsed += c;
      selected.unshift(currentMessage);
    } else if (
      // When a content fragment has more than the remaining number of tokens, we split it.
      isContentFragmentMessageTypeModel(currentMessage) &&
      // Allow at least tokensMargin tokens in addition to the truncation message.
      tokensUsed + approxTruncMsgTokenCount + tokensMargin < allowedTokenCount
    ) {
      const remainingTokens =
        allowedTokenCount - tokensUsed - approxTruncMsgTokenCount;

      const updatedContent = [];
      for (const c of currentMessage.content) {
        if (!isTextContent(c)) {
          // If there is not enough room and it's an image, we simply ignore it.
          continue;
        }

        // Remove only if it ends with "</attachment>".
        const textWithoutClosingAttachmentTag = c.text.replace(
          /<\/attachment>$/,
          ""
        );

        const contentRes = await tokenSplit(
          textWithoutClosingAttachmentTag,
          model,
          remainingTokens
        );
        if (contentRes.isErr()) {
          return new Err(contentRes.error);
        }

        updatedContent.push({
          ...c,
          text: `${contentRes.value}${truncationMessage}</attachment>`,
        });
      }

      selected.unshift({
        ...currentMessage,
        content: updatedContent,
      });

      tokensUsed += remainingTokens;
      break;
    } else {
      break;
    }
  }

  // Merging loop.
  // Merging content fragments into the upcoming user message.
  // Eg: [CF1, CF2, UserMessage, AgentMessage] => [CF1-CF2-UserMessage, AgentMessage]
  for (let i = selected.length - 1; i >= 0; i--) {
    const cfMessage = selected[i];
    if (isContentFragmentMessageTypeModel(cfMessage)) {
      const userMessage = selected[i + 1];
      if (!userMessage || userMessage.role !== "user") {
        logger.error(
          {
            workspaceId: conversation.owner.sId,
            conversationId: conversation.sId,
            selected: selected.map((m) => ({
              ...m,
              content:
                getTextContentFromMessage(m)?.slice(0, 100) + " (truncated...)",
            })),
          },
          "Unexpected state, cannot find user message after a Content Fragment"
        );
        throw new Error(
          "Unexpected state, cannot find user message after a Content Fragment"
        );
      }

      userMessage.content = [...cfMessage.content, ...userMessage.content];
      // Now we remove the content fragment from the array since it was merged into the upcoming
      // user message.
      selected.splice(i, 1);
    }
  }

  while (
    selected.length > 0 &&
    // Most model providers don't support starting by a function result or assistant message.
    ["assistant", "function"].includes(selected[0].role)
  ) {
    const tokenCount = messagesCount[messages.length - selected.length];
    tokensUsed -= tokenCount;
    selected.shift();
  }

  logger.info(
    {
      workspaceId: conversation.owner.sId,
      conversationId: conversation.sId,
      messageCount: messages.length,
      promptToken: promptCount,
      tokensUsed,
      messageSelected: selected.length,
      elapsed: Date.now() - now,
    },
    "[ASSISTANT_TRACE] renderConversationForModelMultiActions"
  );

  return new Ok({
    modelConversation: {
      messages: selected,
    },
    tokensUsed,
  });
}

function listConversationFiles({
  conversation,
}: {
  conversation: ConversationType;
}) {
  const fileAttachments: string[] = [];
  for (const m of conversation.content.flat(1)) {
    if (isContentFragmentType(m)) {
      if (!m.fileId) {
        continue;
      }
      fileAttachments.push(
        `<file id="${m.fileId}" name="${m.title}" type="${m.contentType}" />`
      );
    } else if (isAgentMessageType(m)) {
      for (const a of m.actions) {
        if (isTablesQueryActionType(a)) {
          const attachment = getTablesQueryResultsFileAttachment({
            resultsFileId: a.resultsFileId,
            resultsFileSnippet: a.resultsFileSnippet,
            output: a.output,
            includeSnippet: false,
          });
          if (attachment) {
            fileAttachments.push(attachment);
          }
        }
      }
    }
  }
  let filesAsXML = "<files>\n";

  if (fileAttachments.length > 0) {
    filesAsXML += fileAttachments.join("\n");
  }
  filesAsXML += "\n</files>";

  return { filesAsXML, hasFiles: fileAttachments.length > 0 };
}
