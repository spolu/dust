import type { WithAPIErrorReponse } from "@dust-tt/types";
import type { NextApiRequest, NextApiResponse } from "next";

import { getAgentConfigurations } from "@app/lib/api/assistant/configuration";
import { Authenticator, getAPIKey } from "@app/lib/auth";
import { apiError, withLogging } from "@app/logger/withlogging";
import type { GetAgentConfigurationsResponseBody } from "@app/pages/api/w/[wId]/assistant/agent_configurations";

/**
 * @swagger
 * /api/v1/w/{wId}/assistant/agent_configurations:
 *   get:
 *     summary: Get the list of assistants
 *     description: Get the agent configurations for the workspace identified by {wId}.
 *     tags:
 *       - Workspace
 *     parameters:
 *       - in: path
 *         name: wId
 *         required: true
 *         description: ID of the workspace
 *         schema:
 *           type: string
 *      - in: header
 *        name: Authorization
 *        required: true
 *        description: Bearer token for authentication
 *        schema:
 *         type: string
 *     responses:
 *       200:
 *         description: Agent configurations for the workspace
 *       400:
 *         description: Bad Request. Missing or invalid parameters.
 *       401:
 *         description: Unauthorized. Invalid or missing authentication token.
 *       500:
 *         description: Internal Server Error.
 *       404:
 *         description: Workspace not found.
 *       405:
 *         description: Method not supported. Only GET is expected.
 */

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WithAPIErrorReponse<GetAgentConfigurationsResponseBody>>
): Promise<void> {
  const keyRes = await getAPIKey(req);
  if (keyRes.isErr()) {
    return apiError(req, res, keyRes.error);
  }

  const { auth, keyWorkspaceId } = await Authenticator.fromKey(
    keyRes.value,
    req.query.wId as string
  );

  if (!auth.isBuilder() || keyWorkspaceId !== req.query.wId) {
    return apiError(req, res, {
      status_code: 400,
      api_error: {
        type: "invalid_request_error",
        message: "The Assistant API is only available on your own workspace.",
      },
    });
  }

  switch (req.method) {
    case "GET": {
      const agentConfigurations = await getAgentConfigurations({
        auth,
        agentsGetView: "all",
        variant: "light",
      });
      return res.status(200).json({
        agentConfigurations,
      });
    }
    default:
      return apiError(req, res, {
        status_code: 405,
        api_error: {
          type: "method_not_supported_error",
          message: "The method passed is not supported, only GET is expected.",
        },
      });
  }
}

export default withLogging(handler);
