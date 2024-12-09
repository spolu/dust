import type { WithAPIErrorResponse } from "@dust-tt/types";
import type { NextApiRequest, NextApiResponse } from "next";

import { getAgentConfiguration } from "@app/lib/api/assistant/configuration";
import { withSessionAuthenticationForWorkspace } from "@app/lib/api/auth_wrappers";
import { Authenticator } from "@app/lib/auth";
import { AgentMessageFeedbackResource } from "@app/lib/resources/agent_message_feedback_resource";
import { apiError } from "@app/logger/withlogging";

export type GetAgentConfigurationsResponseBody = {
  conversationId: string;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    WithAPIErrorResponse<GetAgentConfigurationsResponseBody | void>
  >,
  auth: Authenticator
): Promise<void> {
  switch (req.method) {
    case "GET":
      const feedbackId = req.query.fId;
      if (typeof feedbackId !== "string" || feedbackId === "") {
        return apiError(req, res, {
          status_code: 400,
          api_error: {
            type: "invalid_request_error",
            message: "Invalid query parameters, `fId` (string) is required.",
          },
        });
      }

      // Make sure that user is one of the authors
      const feedback = await AgentMessageFeedbackResource.fetchById(feedbackId);
      if (!feedback) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "feedback_not_found",
            message: `Feedback not found for id ${feedbackId}`,
          },
        });
      }
      const agent = await getAgentConfiguration(
        auth,
        feedback.agentConfigurationId
      );
      if (!agent) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "agent_configuration_not_found",
            message: `Agent configuration not found for id ${feedback.agentConfigurationId}`,
          },
        });
      }
      if (
        !auth.canRead(
          Authenticator.createResourcePermissionsFromGroupIds(
            agent.requestedGroupIds
          )
        )
      ) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "feedback_not_found",
            message: "Feedback not found.",
          },
        });
      }

      const conversationId =
        await AgentMessageFeedbackResource.fetchConversationId(feedbackId);

      if (!conversationId) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "conversation_not_found",
            message: `Conversation not found for feedback ${feedbackId}`,
          },
        });
      }

      return res.status(200).json({
        conversationId,
      });
    default:
      return apiError(req, res, {
        status_code: 405,
        api_error: {
          type: "method_not_supported_error",
          message: "The method passed is not supported, GET is expected.",
        },
      });
  }
}

export default withSessionAuthenticationForWorkspace(handler);
