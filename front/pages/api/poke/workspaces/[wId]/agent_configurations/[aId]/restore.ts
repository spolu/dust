import type { WithAPIErrorReponse } from "@dust-tt/types";
import type { NextApiRequest, NextApiResponse } from "next";

import {
  getAgentConfiguration,
  restoreAgentConfiguration,
} from "@app/lib/api/assistant/configuration";
import { Authenticator, getSession } from "@app/lib/auth";
import { apiError, withLogging } from "@app/logger/withlogging";

export type RestoreAgentConfigurationResponseBody = {
  success: true;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    WithAPIErrorReponse<RestoreAgentConfigurationResponseBody>
  >
): Promise<void> {
  const session = await getSession(req, res);
  const auth = await Authenticator.fromSuperUserSession(
    session,
    req.query.wId as string
  );

  if (!auth.isDustSuperUser()) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "user_not_found",
        message: "Could not find the user.",
      },
    });
  }

  switch (req.method) {
    case "POST":
      const { wId } = req.query;
      if (!wId || typeof wId !== "string") {
        return apiError(req, res, {
          status_code: 400,
          api_error: {
            type: "invalid_request_error",
            message: "The request query is invalid, [wId] must be set.",
          },
        });
      }

      const agentConfiguration = await getAgentConfiguration(
        auth,
        req.query.aId as string
      );
      if (!agentConfiguration) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "agent_configuration_not_found",
            message: "Could not find the agent configuration.",
          },
        });
      }

      const restored = await restoreAgentConfiguration(
        auth,
        agentConfiguration.sId
      );

      if (!restored) {
        return apiError(req, res, {
          status_code: 500,
          api_error: {
            type: "internal_server_error",
            message: "Could not restore the agent configuration.",
          },
        });
      }

      return res.status(200).json({ success: true });

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

export default withLogging(handler);
