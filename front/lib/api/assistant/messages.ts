import type {
  AgentActionType,
  DustAppParameters,
  DustAppRunActionType,
  TablesQueryActionType,
} from "@dust-tt/types";
import type {
  AgentMessageType,
  ContentFragmentType,
  LightAgentConfigurationType,
  UserMessageType,
} from "@dust-tt/types";
import { removeNulls } from "@dust-tt/types";
import type { WhereOptions } from "sequelize";
import { Op } from "sequelize";

import { renderRetrievalActionsByModelId } from "@app/lib/api/assistant/actions/retrieval";
import { getAgentConfiguration } from "@app/lib/api/assistant/configuration";
import type { Authenticator } from "@app/lib/auth";
import {
  AgentDustAppRunAction,
  AgentMessage,
  AgentTablesQueryAction,
  Conversation,
  Mention,
  Message,
  User,
  UserMessage,
} from "@app/lib/models";
import { ContentFragmentResource } from "@app/lib/resources/content_fragment_resource";
import { ContentFragmentModel } from "@app/lib/resources/storage/models/content_fragment";

export async function batchRenderUserMessages(
  messages: Message[]
): Promise<{ m: UserMessageType; rank: number; version: number }[]> {
  const userMessages = messages.filter(
    (m) => m.userMessage !== null && m.userMessage !== undefined
  );
  const [mentions, users] = await Promise.all([
    Mention.findAll({
      where: {
        messageId: userMessages.map((m) => m.id),
      },
      include: [
        {
          model: User,
          as: "user",
          required: false,
        },
      ],
    }),
    (async () => {
      const userIds = userMessages
        .map((m) => m.userMessage?.userId)
        .filter((id) => !!id) as number[];
      if (userIds.length === 0) {
        return [];
      }
      return User.findAll({
        where: {
          id: userIds,
        },
      });
    })(),
  ]);

  return userMessages.map((message) => {
    if (!message.userMessage) {
      throw new Error(
        "Unreachable: batchRenderUserMessages has been filtered on user messages"
      );
    }
    const userMessage = message.userMessage;
    const messageMentions = mentions.filter((m) => m.messageId === message.id);
    const user = users.find((u) => u.id === userMessage.userId) || null;

    const m = {
      id: message.id,
      sId: message.sId,
      type: "user_message",
      visibility: message.visibility,
      version: message.version,
      created: message.createdAt.getTime(),
      user: user
        ? {
            id: user.id,
            createdAt: user.createdAt.getTime(),
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName:
              user.firstName + (user.lastName ? ` ${user.lastName}` : ""),
            provider: user.provider,
            image: user.imageUrl,
          }
        : null,
      mentions: messageMentions.map((m) => {
        if (m.agentConfigurationId) {
          return {
            configurationId: m.agentConfigurationId,
          };
        }
        throw new Error("Mention Must Be An Agent: Unreachable.");
      }),
      content: userMessage.content,
      context: {
        username: userMessage.userContextUsername,
        timezone: userMessage.userContextTimezone,
        fullName: userMessage.userContextFullName,
        email: userMessage.userContextEmail,
        profilePictureUrl: userMessage.userContextProfilePictureUrl,
      },
    } satisfies UserMessageType;
    return { m, rank: message.rank, version: message.version };
  });
}

export async function batchRenderAgentMessages(
  auth: Authenticator,
  messages: Message[]
): Promise<{ m: AgentMessageType; rank: number; version: number }[]> {
  const agentMessages = messages.filter((m) => !!m.agentMessage);

  const [
    agentConfigurations,
    agentRetrievalActions,
    agentDustAppRunActions,
    agentTablesQueryActions,
  ] = await Promise.all([
    (async () => {
      const agentConfigurationIds: string[] = agentMessages.reduce(
        (acc: string[], m) => {
          const agentId = m.agentMessage?.agentConfigurationId;
          if (agentId && !acc.includes(agentId)) {
            acc.push(agentId);
          }
          return acc;
        },
        []
      );
      const agents = (
        await Promise.all(
          agentConfigurationIds.map((agentConfigId) => {
            return getAgentConfiguration(auth, agentConfigId);
          })
        )
      ).filter((a) => a !== null) as LightAgentConfigurationType[];
      return agents;
    })(),
    (async () => {
      return renderRetrievalActionsByModelId(
        removeNulls(
          agentMessages.map(
            (m) => m.agentMessage?.agentRetrievalActionId ?? null
          )
        )
      );
    })(),
    (async () => {
      const actions = await AgentDustAppRunAction.findAll({
        where: {
          id: {
            [Op.in]: agentMessages
              .filter((m) => m.agentMessage?.agentDustAppRunActionId)
              .map((m) => m.agentMessage?.agentDustAppRunActionId as number),
          },
        },
      });
      return actions.map((action) => {
        return {
          id: action.id,
          type: "dust_app_run_action",
          appWorkspaceId: action.appWorkspaceId,
          appId: action.appId,
          appName: action.appName,
          params: action.params,
          runningBlock: null,
          output: action.output,
        } satisfies DustAppRunActionType;
      });
    })(),
    (async () => {
      const actions = await AgentTablesQueryAction.findAll({
        where: {
          id: {
            [Op.in]: agentMessages
              .filter((m) => m.agentMessage?.agentTablesQueryActionId)
              .map((m) => m.agentMessage?.agentTablesQueryActionId as number),
          },
        },
      });
      return actions.map((action) => {
        return {
          id: action.id,
          type: "tables_query_action",
          params: action.params as DustAppParameters,
          output: action.output as Record<string, string | number | boolean>,
        } satisfies TablesQueryActionType;
      });
    })(),
  ]);

  return agentMessages.map((message) => {
    if (!message.agentMessage) {
      throw new Error(
        "Unreachable: batchRenderAgentMessages has been filtered on agent message"
      );
    }
    const agentMessage = message.agentMessage;

    let action: AgentActionType | null = null;
    if (agentMessage.agentRetrievalActionId) {
      action =
        agentRetrievalActions.find(
          (a) => a.id === agentMessage.agentRetrievalActionId
        ) || null;
    } else if (agentMessage.agentDustAppRunActionId) {
      action =
        agentDustAppRunActions.find(
          (a) => a.id === agentMessage.agentDustAppRunActionId
        ) || null;
    } else if (agentMessage.agentTablesQueryActionId) {
      action =
        agentTablesQueryActions.find(
          (a) => a.id === agentMessage.agentTablesQueryActionId
        ) || null;
    }
    const agentConfiguration = agentConfigurations.find(
      (a) => a.sId === agentMessage.agentConfigurationId
    );
    if (!agentConfiguration) {
      throw new Error(
        "Unreachable: agent configuration must be found for agent message"
      );
    }

    let error: {
      code: string;
      message: string;
    } | null = null;

    if (agentMessage.errorCode !== null && agentMessage.errorMessage !== null) {
      error = {
        code: agentMessage.errorCode,
        message: agentMessage.errorMessage,
      };
    }

    const m = {
      id: message.id,
      sId: message.sId,
      created: message.createdAt.getTime(),
      type: "agent_message",
      visibility: message.visibility,
      version: message.version,
      parentMessageId:
        messages.find((m) => m.id === message.parentId)?.sId ?? null,
      status: agentMessage.status,
      action,
      content: agentMessage.content,
      error,
      configuration: agentConfiguration,
    } satisfies AgentMessageType;
    return { m, rank: message.rank, version: message.version };
  });
}

export async function batchRenderContentFragment(
  messages: Message[]
): Promise<{ m: ContentFragmentType; rank: number; version: number }[]> {
  const messagesWithContentFragment = messages.filter(
    (m) => !!m.contentFragment
  );
  if (messagesWithContentFragment.find((m) => !m.contentFragment)) {
    throw new Error(
      "Unreachable: batchRenderContentFragment must be called with only content fragments"
    );
  }

  return messagesWithContentFragment.map((message: Message) => {
    const contentFragment = ContentFragmentResource.fromMessage(message);

    return {
      m: contentFragment.renderFromMessage(message),
      rank: message.rank,
      version: message.version,
    };
  });
}

