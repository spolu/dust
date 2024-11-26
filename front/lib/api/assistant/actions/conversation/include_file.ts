import type {
  AgentActionSpecification,
  ContentFragmentType,
  ConversationIncludeFileActionType,
  ConversationIncludeFileConfigurationType,
  ConversationIncludeFileErrorEvent,
  ConversationIncludeFileParamsEvent,
  ConversationIncludeFileSuccessEvent,
  ConversationType,
  FunctionCallType,
  FunctionMessageTypeModel,
  ModelConfigurationType,
  ModelId,
  Result,
  SupportedContentFragmentType,
} from "@dust-tt/types";
import { CoreAPI, Err, Ok } from "@dust-tt/types";
import {
  assertNever,
  BaseAction,
  isContentFragmentType,
  isSupportedImageContentType,
  isTextContent,
} from "@dust-tt/types";

import {
  DEFAULT_CONVERSATION_INCLUDE_FILE_ACTION_DESCRIPTION,
  DEFAULT_CONVERSATION_INCLUDE_FILE_ACTION_NAME,
  DEFAULT_CONVERSATION_QUERY_TABLES_ACTION_NAME,
  DEFAULT_CONVERSATION_SEARCH_ACTION_NAME,
} from "@app/lib/api/assistant/actions/constants";
import type { BaseActionRunParams } from "@app/lib/api/assistant/actions/types";
import { BaseActionConfigurationServerRunner } from "@app/lib/api/assistant/actions/types";
import config from "@app/lib/api/config";
import { getSupportedModelConfig } from "@app/lib/assistant";
import type { Authenticator } from "@app/lib/auth";
import { AgentConversationIncludeFileAction } from "@app/lib/models/assistant/actions/conversation/include_file";
import { renderContentFragmentForModel } from "@app/lib/resources/content_fragment_resource";
import { generateRandomModelSId } from "@app/lib/resources/string_ids";
import logger from "@app/logger/logger";

export function isConversationIncludableFileContentType(
  contentType: SupportedContentFragmentType
): boolean {
  if (isSupportedImageContentType(contentType)) {
    return false;
  }
  // For now we only allow including text files.
  switch (contentType) {
    case "application/msword":
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/pdf":
    case "text/markdown":
    case "text/plain":
    case "dust-application/slack":
    case "text/comma-separated-values":
    case "text/csv":
      return true;

    case "text/tab-separated-values":
    case "text/tsv":
      return false;
    default:
      assertNever(contentType);
  }
}

interface ConversationIncludeFileActionBlob {
  id: ModelId;
  agentMessageId: ModelId;
  params: {
    fileId: string;
  };
  tokensCount: number | null;
  fileTitle: string | null;
  functionCallId: string | null;
  functionCallName: string | null;
  step: number;
}

const CONTEXT_SIZE_DIVISOR_FOR_INCLUDE = 4;

export class ConversationIncludeFileAction extends BaseAction {
  readonly agentMessageId: ModelId;
  readonly params: {
    fileId: string;
  };
  readonly tokensCount: number | null = null;
  readonly fileTitle: string | null = null;
  readonly contentFragments: null[] = [];
  readonly functionCallId: string | null;
  readonly functionCallName: string | null;
  readonly step: number = -1;
  readonly type = "conversation_include_file_action";

  constructor(blob: ConversationIncludeFileActionBlob) {
    super(blob.id, "conversation_include_file_action");

    this.agentMessageId = blob.agentMessageId;
    this.params = blob.params;
    this.tokensCount = blob.tokensCount;
    this.fileTitle = blob.fileTitle;
    this.functionCallId = blob.functionCallId;
    this.functionCallName = blob.functionCallName;
    this.step = blob.step;
  }

  static async fileFromConversation(
    fileId: string,
    conversation: ConversationType,
    model: ModelConfigurationType
  ): Promise<
    Result<{ fileId: string; title: string; content: string }, string>
  > {
    // Note on `contentFragmentVersion`: two content fragment versions are created with different
    // fileIds. So we accept here rendering content fragments that are superseded. This will mean
    // that past actions on a previous version of a content fragment will correctly render the
    // content as being superseded showing the model that a new version available. The fileId of
    // that new version will be different but the title will likely be the same and the model should
    // be able to undertstand the state of affair. We use content.flat() to consider all versions of
    // messages here (to support rendering a file that was part of an old version of a previous
    // message).
    const m = (conversation.content.flat().find((m) => {
      if (
        isContentFragmentType(m) &&
        isConversationIncludableFileContentType(m.contentType) &&
        m.fileId === fileId
      ) {
        return true;
      }
      return false;
    }) || null) as ContentFragmentType | null;

    if (!m) {
      return new Err(
        `File \`${fileId}\` not includable or not found in conversation`
      );
    }

    const rRes = await renderContentFragmentForModel(m, conversation, model, {
      // We're not supposed to get images here and we would not know what to do with them.
      excludeImages: true,
    });

    if (rRes.isErr()) {
      return new Err(`${rRes.error}`);
    }
    if (!isTextContent(rRes.value.content[0])) {
      return new Err(`File \`${fileId}\` has no text content`);
    }
    const text = rRes.value.content[0].text;

    return new Ok({
      fileId,
      title: m.title,
      content: text,
    });
  }

  renderForFunctionCall(): FunctionCallType {
    return {
      id: this.functionCallId ?? `call_${this.id.toString()}`,
      name:
        this.functionCallName ?? DEFAULT_CONVERSATION_INCLUDE_FILE_ACTION_NAME,
      arguments: JSON.stringify(this.params),
    };
  }

  async renderForMultiActionsModel({
    conversation,
    model,
  }: {
    conversation: ConversationType;
    model: ModelConfigurationType;
  }): Promise<FunctionMessageTypeModel> {
    const finalize = (content: string) => {
      return {
        role: "function" as const,
        name:
          this.functionCallName ??
          DEFAULT_CONVERSATION_INCLUDE_FILE_ACTION_NAME,
        function_call_id: this.functionCallId ?? `call_${this.id.toString()}`,
        content,
      };
    };

    const textRes = await ConversationIncludeFileAction.fileFromConversation(
      this.params.fileId,
      conversation,
      model
    );
    if (textRes.isErr()) {
      return finalize(`Error: ${textRes.error}`);
    }

    if (this.tokensCount === null) {
      return finalize(`Error: the file content was not tokenized`);
    }

    // We include a file only if it's smaller than the context size divided by
    // CONTEXT_SIZE_DIVISOR_FOR_INCLUDE. This is a departure form the existing logic where we
    // present attachments as user messages whose content is possibly truncated. The rationale is to
    // only allow including files that are resonably large otherwise rely on semantic search. If >1
    // files are included they will be represented in the conversation as separate funciton messages
    // which may be filtered out if they overflow the context size. This may lead to a weird
    // situation where the model includes file 1 2 3 4 5 and at this stage only sees 2 3 4 5 and
    // attempts to include 1.
    // TODO(spolu): test this scenario.
    if (
      this.tokensCount >
      model.contextSize / CONTEXT_SIZE_DIVISOR_FOR_INCLUDE
    ) {
      return finalize(
        `Error: File \`${this.params.fileId}\` has too many tokens to be included, ` +
          `use the \`${DEFAULT_CONVERSATION_SEARCH_ACTION_NAME}\` or ` +
          `\`${DEFAULT_CONVERSATION_QUERY_TABLES_ACTION_NAME}\` actions instead.`
      );
    }

    return finalize(textRes.value.content);
  }
}

/**
 * Params generation.
 */
export class ConversationIncludeFileConfigurationServerRunner extends BaseActionConfigurationServerRunner<ConversationIncludeFileConfigurationType> {
  // Generates the action specification for generation of rawInputs passed to `run`.
  async buildSpecification(
    auth: Authenticator,
    { name, description }: { name: string; description: string | null }
  ): Promise<Result<AgentActionSpecification, Error>> {
    const owner = auth.workspace();
    if (!owner) {
      throw new Error(
        "Unexpected unauthenticated call to `runConversationIncludeFileAction`"
      );
    }

    return new Ok({
      name,
      description:
        description ?? DEFAULT_CONVERSATION_INCLUDE_FILE_ACTION_DESCRIPTION,
      inputs: [
        {
          name: "fileId",
          description:
            "The fileId of the attachment to include in the conversation as returned by the `conversation_list_files_action`",
          type: "string",
        },
      ],
    });
  }

  // This method is mostly a no-op it validates that we did get a fileId as part of the rawInputs
  // and creates the action and return. The inclusion of the fileId content is done in the rendering
  // of the action for the model above.
  async *run(
    auth: Authenticator,
    {
      agentConfiguration,
      conversation,
      agentMessage,
      rawInputs,
      functionCallId,
      step,
    }: BaseActionRunParams
  ): AsyncGenerator<
    | ConversationIncludeFileParamsEvent
    | ConversationIncludeFileSuccessEvent
    | ConversationIncludeFileErrorEvent,
    void
  > {
    const owner = auth.workspace();
    if (!owner) {
      throw new Error("Unexpected unauthenticated call to `run`");
    }

    const { actionConfiguration } = this;

    if (!rawInputs.fileId || typeof rawInputs.fileId !== "string") {
      yield {
        type: "conversation_include_file_error",
        created: Date.now(),
        configurationId: agentConfiguration.sId,
        messageId: agentMessage.sId,
        error: {
          code: "conversation_include_file_parameters_generation_error",
          message: `Error generating parameters for converstaion file inclusion: failed to generate a valid fileId.`,
        },
      };
      return;
    }

    const fileId = rawInputs.fileId;

    // Create the AgentConversationIncludeFileAction object in the database and yield an event for
    // the generation of the params. We store the action here as the params have been generated, if
    // an error occurs later on, the error will be stored on the parent agent message.
    const action = await AgentConversationIncludeFileAction.create({
      fileId,
      functionCallId,
      functionCallName: actionConfiguration.name,
      agentMessageId: agentMessage.agentMessageId,
      step,
    });

    yield {
      type: "conversation_include_file_params",
      created: Date.now(),
      configurationId: agentConfiguration.sId,
      messageId: agentMessage.sId,
      action: new ConversationIncludeFileAction({
        id: action.id,
        params: {
          fileId,
        },
        tokensCount: null,
        fileTitle: null,
        functionCallId,
        functionCallName: actionConfiguration.name,
        agentMessageId: agentMessage.agentMessageId,
        step,
      }),
    };

    const model = getSupportedModelConfig(agentConfiguration.model);
    const fileRes = await ConversationIncludeFileAction.fileFromConversation(
      fileId,
      conversation,
      model
    );
    if (fileRes.isErr()) {
      // We error here if the file was not found which will interrupt the agent loop. We might want
      // to consider letting this error go through here in the future if it happens non trivially
      // frequently so that we can present the failure in the action result instead (to give a
      // chance to the model to recover).
      yield {
        type: "conversation_include_file_error",
        created: Date.now(),
        configurationId: agentConfiguration.sId,
        messageId: agentMessage.sId,
        error: {
          code: "conversation_include_file_error",
          message: `Error including conversation file: ${fileRes.error}`,
        },
      };
      return;
    }

    const coreAPI = new CoreAPI(config.getCoreAPIConfig(), logger);
    const tokensRes = await coreAPI.tokenize({
      text: fileRes.value.content,
      providerId: model.providerId,
      modelId: model.modelId,
    });

    if (tokensRes.isErr()) {
      yield {
        type: "conversation_include_file_error",
        created: Date.now(),
        configurationId: agentConfiguration.sId,
        messageId: agentMessage.sId,
        error: {
          code: "conversation_include_file_error",
          message: `Error including conversation file: ${tokensRes.error}`,
        },
      };
      return;
    }

    // Store the tokens count and file title on the action model for use in the rendering of the
    // action for the model (token count) and the rendering of the action details (file title).
    await action.update({
      tokensCount: tokensRes.value.tokens.length,
      fileTitle: fileRes.value.title,
    });

    yield {
      type: "conversation_include_file_success",
      created: Date.now(),
      configurationId: agentConfiguration.sId,
      messageId: agentMessage.sId,
      action: new ConversationIncludeFileAction({
        id: action.id,
        params: {
          fileId,
        },
        tokensCount: tokensRes.value.tokens.length,
        fileTitle: fileRes.value.title,
        functionCallId,
        functionCallName: actionConfiguration.name,
        agentMessageId: agentMessage.agentMessageId,
        step,
      }),
    };
  }
}

/**
 * Action rendering.
 */

// Internal interface for the retrieval and rendering of a ConversationIncludeFile actions. This
// should not be used outside of api/assistant. We allow a ModelId interface here because we don't
// have `sId` on actions (the `sId` is on the `Message` object linked to the `UserMessage` parent of
// this action).
export async function conversationIncludeFileTypesFromAgentMessageIds(
  agentMessageIds: ModelId[]
): Promise<ConversationIncludeFileActionType[]> {
  const actions = await AgentConversationIncludeFileAction.findAll({
    where: {
      agentMessageId: agentMessageIds,
    },
  });

  return actions.map((action) => {
    return new ConversationIncludeFileAction({
      id: action.id,
      params: { fileId: action.fileId },
      tokensCount: action.tokensCount,
      fileTitle: action.fileTitle,
      functionCallId: action.functionCallId,
      functionCallName: action.functionCallName,
      agentMessageId: action.agentMessageId,
      step: action.step,
    });
  });
}

/**
 * JIT action configration construction
 */

export function makeConversationIncludeFileConfiguration(): ConversationIncludeFileConfigurationType {
  return {
    id: -1,
    sId: generateRandomModelSId(),
    type: "conversation_include_file_configuration",
    name: DEFAULT_CONVERSATION_INCLUDE_FILE_ACTION_NAME,
    description: DEFAULT_CONVERSATION_INCLUDE_FILE_ACTION_DESCRIPTION,
  };
}
