import type {
  ConversationType,
  ConversationWithoutContentType,
  Result,
} from "@dust-tt/types";
import type { UserType } from "@dust-tt/types";
import { ConversationError, Err, Ok } from "@dust-tt/types";

import { getAgentConfiguration } from "@app/lib/api/assistant/configuration";
import { canAccessConversation } from "@app/lib/api/assistant/conversation/auth";
import type { AgentMessageFeedbackDirection } from "@app/lib/api/assistant/conversation/feedbacks";
import type { Authenticator } from "@app/lib/auth";
import { AgentMessageFeedbackResource } from "@app/lib/resources/agent_message_feedback_resource";

/**
 * We retrieve the feedbacks for a whole conversation, not just a single message.
 */

export type AgentMessageFeedbackType = {
  id: number;
  messageId: string;
  agentMessageId: number;
  userId: number;
  thumbDirection: AgentMessageFeedbackDirection;
  content: string | null;
  createdAt: Date;
  agentConfigurationId: string;
  agentConfigurationVersion: number;
  isConversationShared: boolean;
};

export type AgentMessageFeedbackWithMetadataType = AgentMessageFeedbackType & {
  conversationId: string | null;
  userName: string;
  userEmail: string;
  userImageUrl: string | null;
};

export async function getConversationFeedbacksForUser(
  auth: Authenticator,
  conversation: ConversationType | ConversationWithoutContentType
): Promise<Result<AgentMessageFeedbackType[], ConversationError>> {
  const owner = auth.workspace();
  if (!owner) {
    throw new Error("Unexpected `auth` without `workspace`.");
  }
  const user = auth.user();
  if (!canAccessConversation(auth, conversation) || !user) {
    return new Err(new ConversationError("conversation_access_restricted"));
  }

  const feedbacks =
    await AgentMessageFeedbackResource.getConversationFeedbacksForUser(
      auth,
      conversation
    );

  if (feedbacks.isErr()) {
    return new Err(feedbacks.error);
  }

  return new Ok(feedbacks.value);
}

/**
 * We create a feedback for a single message.
 * As user can be null (user from Slack), we also store the user context, as we do for messages.
 */
export async function upsertMessageFeedback(
  auth: Authenticator,
  {
    messageId,
    conversation,
    user,
    thumbDirection,
    content,
    isConversationShared,
  }: {
    messageId: string;
    conversation: ConversationType | ConversationWithoutContentType;
    user: UserType;
    thumbDirection: AgentMessageFeedbackDirection;
    content?: string;
    isConversationShared?: boolean;
  }
) {
  const owner = auth.workspace();
  if (!owner) {
    return new Err({
      type: "workspace_not_found",
      message: "The workspace you're trying to access was not found.",
    });
  }
  const feedbackWithConversationContext =
    await AgentMessageFeedbackResource.getFeedbackWithConversationContext({
      auth,
      messageId,
      conversation,
      user,
    });

  if (feedbackWithConversationContext.isErr()) {
    return feedbackWithConversationContext;
  }

  const { agentMessage, feedback, agentConfiguration, isGlobalAgent } =
    feedbackWithConversationContext.value;

  if (feedback) {
    await feedback.updateFields({
      content: content ?? "",
      thumbDirection,
      isConversationShared: false,
    });
    return new Ok(undefined);
  }

  try {
    await AgentMessageFeedbackResource.makeNew({
      workspaceId: auth.getNonNullableWorkspace().id,
      // If the agent is global, we use the agent configuration id from the agent message
      // Otherwise, we use the agent configuration id from the agent configuration
      agentConfigurationId: isGlobalAgent
        ? agentMessage.agentConfigurationId
        : agentConfiguration.sId,
      agentConfigurationVersion: agentMessage.agentConfigurationVersion,
      agentMessageId: agentMessage.id,
      userId: user.id,
      thumbDirection,
      content,
      isConversationShared: isConversationShared ?? false,
    });
  } catch (e) {
    return new Err(e as Error);
  }
  return new Ok(undefined);
}

/**
 * The id of a feedback is not exposed on the API so we need to find it from the message id and the user context.
 * We destroy feedbacks, no point in soft-deleting them.
 */
export async function deleteMessageFeedback(
  auth: Authenticator,
  {
    messageId,
    conversation,
    user,
  }: {
    messageId: string;
    conversation: ConversationType | ConversationWithoutContentType;
    user: UserType;
  }
) {
  const owner = auth.workspace();
  if (!owner) {
    return new Err({
      type: "workspace_not_found",
      message: "The workspace you're trying to access was not found.",
    });
  }

  if (!canAccessConversation(auth, conversation)) {
    return new Err({
      type: "conversation_access_restricted",
      message: "You don't have access to this conversation.",
    });
  }

  const feedbackWithContext =
    await AgentMessageFeedbackResource.getFeedbackWithConversationContext({
      auth,
      messageId,
      conversation,
      user,
    });

  if (feedbackWithContext.isErr()) {
    return feedbackWithContext;
  }

  const { feedback } = feedbackWithContext.value;

  if (!feedback) {
    return new Ok(undefined);
  }

  const deleteRes = await feedback.delete(auth, {});

  if (deleteRes.isErr()) {
    return deleteRes;
  }

  return new Ok(undefined);
}

export async function fetchAgentFeedbacks({
  auth,
  agentConfigurationId,
  withMetadata,
  filters,
}: {
  auth: Authenticator;
  withMetadata: boolean;
  agentConfigurationId: string;
  filters?: {
    limit?: number;
    olderThan?: Date;
    earlierThan?: Date;
  };
}): Promise<
  Result<
    (AgentMessageFeedbackType | AgentMessageFeedbackWithMetadataType)[],
    Error
  >
> {
  const owner = auth.workspace();
  if (!owner || !auth.isUser()) {
    throw new Error("Unexpected `auth` without `workspace`.");
  }
  const plan = auth.plan();
  if (!plan) {
    throw new Error("Unexpected `auth` without `plan`.");
  }

  // Make sure the user has access to the agent
  const agentConfiguration = await getAgentConfiguration(
    auth,
    agentConfigurationId
  );
  if (!agentConfiguration) {
    return new Err(new Error("agent_configuration_not_found"));
  }

  const feedbacksRes = await AgentMessageFeedbackResource.fetch({
    workspaceId: owner.sId,
    agentConfiguration,
    filters,
    withMetadata,
  });

  if (!withMetadata) {
    return new Ok(feedbacksRes);
  }

  const feedbacks = (
    feedbacksRes as AgentMessageFeedbackWithMetadataType[]
  ).map((feedback) => ({
    ...feedback,
    // Only display conversationId if the feedback was shared
    conversationId: feedback.isConversationShared
      ? feedback.conversationId
      : null,
  }));
  return new Ok(feedbacks);
}
