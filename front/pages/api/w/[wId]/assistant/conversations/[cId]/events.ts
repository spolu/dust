import { isLeft } from "fp-ts/lib/Either";
import * as t from "io-ts";
import * as reporter from "io-ts-reporters";
import { NextApiRequest, NextApiResponse } from "next";

import { getConversation } from "@app/lib/api/assistant/conversation";
import {
  cancelMessageGenerationEvent,
  getConversationEvents,
} from "@app/lib/api/assistant/pubsub";
import { Authenticator, getSession } from "@app/lib/auth";
import { ReturnedAPIErrorType } from "@app/lib/error";
import { apiError, withLogging } from "@app/logger/withlogging";

export type PostMessageEventResponseBody = {
  success: true;
};
const PostMessageEventBodySchema = t.type({
  action: t.literal("cancel"),
  messageIds: t.array(t.string),
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PostMessageEventResponseBody | ReturnedAPIErrorType>
): Promise<void> {
  const session = await getSession(req, res);
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

  if (!auth.user()) {
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
        message:
          "Only users of the current workspace can access chat sessions.",
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
  const conversationId = req.query.cId;
  const conversation = await getConversation(auth, conversationId);

  if (!conversation) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "conversation_not_found",
        message: "The conversation you're trying to access was not found.",
      },
    });
  }

  const lastEventId = req.query.lastEventId || null;
  if (lastEventId && typeof lastEventId !== "string") {
    return apiError(req, res, {
      status_code: 400,
      api_error: {
        type: "invalid_request_error",
        message:
          "Invalid query parameters, `lastEventId` should be string if specified.",
      },
    });
  }

  switch (req.method) {
    case "GET":
      const eventStream = getConversationEvents(conversationId, lastEventId);

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.flushHeaders();

      for await (const event of eventStream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        // @ts-expect-error - We need it for streaming but it does not exists in the types.
        res.flush();
      }
      res.write("data: done\n\n");
      // @ts-expect-error - We need it for streaming but it does not exists in the types.
      res.flush();

      res.status(200).end();
      return;

    case "POST":
      const bodyValidation = PostMessageEventBodySchema.decode(req.body);
      if (isLeft(bodyValidation)) {
        const pathError = reporter.formatValidationErrors(bodyValidation.left);

        return apiError(req, res, {
          status_code: 400,
          api_error: {
            type: "invalid_request_error",
            message: `Invalid request body: ${pathError}`,
          },
        });
      }
      await cancelMessageGenerationEvent(bodyValidation.right.messageIds);
      return res.status(200).json({ success: true });

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

export default withLogging(handler, true);
