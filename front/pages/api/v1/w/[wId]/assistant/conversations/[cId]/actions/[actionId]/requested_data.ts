import type { WithAPIErrorResponse } from "@dust-tt/types";
import type { NextApiRequest, NextApiResponse } from "next";

import { getConversationWithoutContent } from "@app/lib/api/assistant/conversation";
import { apiErrorForConversation } from "@app/lib/api/assistant/conversation/helper";
import { getRedisClient } from "@app/lib/api/redis";
import { withPublicAPIAuthentication } from "@app/lib/api/wrappers";
import type { Authenticator } from "@app/lib/auth";
import { apiError } from "@app/logger/withlogging";

/**
 * @ignoreswagger
 * Internal API key only endpoint. Undocumented.
 */

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WithAPIErrorResponse<void>>,
  auth: Authenticator
): Promise<void> {
  const { cId, actionId } = req.query;
  if (typeof cId !== "string") {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "conversation_not_found",
        message: "Conversation not found.",
      },
    });
  }

  const conversationRes = await getConversationWithoutContent(auth, cId);

  if (conversationRes.isErr()) {
    return apiErrorForConversation(req, res, conversationRes.error);
  }

  if (typeof actionId !== "string") {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "conversation_not_found",
        message: "Action not found.",
      },
    });
  }
  switch (req.method) {
    case "POST":
      const redis = await getRedisClient({ origin: "request_user_data" });
      await redis.xAdd(`request_data_action_${actionId}`, "*", {
        payload: JSON.stringify(req.body),
      });
      res.status(200).end();
      return;

    default:
      return apiError(req, res, {
        status_code: 405,
        api_error: {
          type: "method_not_supported_error",
          message: "The method passed is not supported, POST is expected.",
        },
      });
  }
}

export default withPublicAPIAuthentication(handler, { isStreaming: true });
