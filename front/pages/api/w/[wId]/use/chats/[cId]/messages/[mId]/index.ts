import { JSONSchemaType } from "ajv";
import { NextApiRequest, NextApiResponse } from "next";

import { getChatMessage, upsertChatMessage } from "@app/lib/api/chat";
import { Authenticator, getSession, getUserFromSession } from "@app/lib/auth";
import { ReturnedAPIErrorType } from "@app/lib/error";
import { parse_payload } from "@app/lib/http_utils";
import { apiError, withLogging } from "@app/logger/withlogging";
import { ChatMessageType, ChatRetrievedDocumentType } from "@app/types/chat";
import {
  ChatMessage,
  ChatRetrievedDocument,
  ChatSession,
  front_sequelize,
} from "@app/lib/models";

const chatRetrievedDocumentSchema: JSONSchemaType<ChatRetrievedDocumentType> = {
  type: "object",
  properties: {
    dataSourceId: { type: "string" },
    sourceUrl: { type: "string" },
    documentId: { type: "string" },
    timestamp: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    score: { type: "number" },
    chunks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          offset: { type: "number" },
          score: { type: "number" },
        },
        required: ["text", "offset", "score"],
      },
    },
  },
  required: [
    "dataSourceId",
    "sourceUrl",
    "documentId",
    "timestamp",
    "tags",
    "score",
    "chunks",
  ],
};

export const chatMessageSchema: JSONSchemaType<ChatMessageType> = {
  type: "object",
  properties: {
    mId: { type: "string" },
    role: { type: "string" },
    message: { type: "string", nullable: true },
    retrievals: {
      type: "array",
      items: chatRetrievedDocumentSchema,
      nullable: true,
    },
    query: { type: "string", nullable: true },
    feedback: { type: "string", nullable: true },
  },
  required: ["role"],
};

export type ChatMessageResponseBody = {
  message: ChatMessageType;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatMessageResponseBody | ReturnedAPIErrorType>
): Promise<void> {
  const session = await getSession(req, res);
  const user = await getUserFromSession(session);
  const auth = await Authenticator.fromSession(
    session,
    req.query.wId as string
  );

  const owner = auth.workspace();
  if (!owner) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "workspace_not_found",
        message: "The workspace you're trying to modify was not found.",
      },
    });
  }

  if (!user) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "workspace_user_not_found",
        message: "Could not find the user of the current session.",
      },
    });
  }

  if (!auth.isUser()) {
    return apiError(req, res, {
      status_code: 403,
      api_error: {
        type: "workspace_auth_error",
        message: "Only users of the current workspace can retrieve chats.",
      },
    });
  }

  if (!(typeof req.query.cId === "string")) {
    return apiError(req, res, {
      status_code: 400,
      api_error: {
        type: "invalid_request_error",
        message: "Invalid query parameters, `cId` (string) is required.",
      },
    });
  }

  const chatSession = await ChatSession.findOne({
    where: {
      workspaceId: owner.id,
      sId: req.query.cId,
    },
  });
  if (!chatSession) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "chat_session_not_found",
        message:
          "The chat session for the message you're trying to modify was not found.",
      },
    });
  }

  if (!(typeof req.query.mId === "string")) {
    return apiError(req, res, {
      status_code: 400,
      api_error: {
        type: "invalid_request_error",
        message: "Invalid query parameters, `mId` (string) is required.",
      },
    });
  }
  const mId = req.query.mId;

  switch (req.method) {
    case "POST": {
      const pRes = parse_payload(chatMessageSchema, req.body);
      if (pRes.isErr()) {
        res.status(400).end();
        return;
      }
      const m = pRes.value;
      const message = await upsertChatMessage(chatSession.id, m, mId);
      res.status(200).json({
        message,
      });
      return;
    }
    case "GET": {
      const message = await getChatMessage(chatSession.id, mId);
      if (!message) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "chat_message_not_found",
            message: "The chat message was not found.",
          },
        });
      }

      res.status(200).json({
        message,
      });
      return;
    }
    case "DELETE": {
      const message = await ChatMessage.findOne({
        where: {
          chatSessionId: chatSession.id,
          mId,
        },
      });
      if (!message) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "chat_message_not_found",
            message: "The chat message was not found.",
          },
        });
      }
      // delete all documents that were retrieved by this message and the message itself
      // in a transaction
      await front_sequelize.transaction(async (t) => {
        await Promise.all([
          ChatRetrievedDocument.destroy({
            where: {
              chatMessageId: message.id,
            },
            transaction: t,
          }),
          message.destroy({
            transaction: t,
          }),
        ]);
      });
      // return the deleted message
      res.status(200).json({
        message,
      });
    }
    default:
      return apiError(req, res, {
        status_code: 405,
        api_error: {
          type: "method_not_supported_error",
          message:
            "The method passed is not supported, GET or POST is expected.",
        },
      });
  }
}

export default withLogging(handler);
