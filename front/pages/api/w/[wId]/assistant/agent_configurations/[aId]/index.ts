import {
  AgentConfigurationType,
  PostOrPatchAgentConfigurationRequestBodySchema,
} from "@dust-tt/types";
import { ReturnedAPIErrorType } from "@dust-tt/types";
import { isLeft } from "fp-ts/lib/Either";
import * as reporter from "io-ts-reporters";
import { NextApiRequest, NextApiResponse } from "next";

import {
  archiveAgentConfiguration,
  getAgentConfiguration,
} from "@app/lib/api/assistant/configuration";
import { Authenticator, getSession } from "@app/lib/auth";
import { apiError, withLogging } from "@app/logger/withlogging";
import { createOrUpgradeAgentConfiguration } from "@app/pages/api/w/[wId]/assistant/agent_configurations";

export type GetAgentConfigurationResponseBody = {
  agentConfiguration: AgentConfigurationType;
};
export type DeleteAgentConfigurationResponseBody = {
  success: boolean;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    | GetAgentConfigurationResponseBody
    | DeleteAgentConfigurationResponseBody
    | ReturnedAPIErrorType
    | void
  >
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
  if (!auth.isUser()) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "app_auth_error",
        message:
          "Only users of the current workspace can access its assistants.",
      },
    });
  }

  switch (req.method) {
    case "GET":
      const assistant = await getAgentConfiguration(
        auth,
        req.query.aId as string
      );
      if (
        !assistant ||
        (assistant.scope === "private" &&
          assistant.versionAuthorId !== auth.user()?.id)
      ) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "agent_configuration_not_found",
            message: "The Assistant you're trying to access was not found.",
          },
        });
      }
      return res.status(200).json({
        agentConfiguration: assistant,
      });
    case "PATCH":
      const bodyValidation =
        PostOrPatchAgentConfigurationRequestBodySchema.decode(req.body);
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

      const assistantToPatch = await getAgentConfiguration(
        auth,
        req.query.aId as string
      );
      if (
        !assistantToPatch ||
        (assistantToPatch.scope === "private" &&
          assistantToPatch.versionAuthorId !== auth.user()?.id)
      ) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "agent_configuration_not_found",
            message: "The Assistant you're trying to patch was not found.",
          },
        });
      }
      if (assistantToPatch.scope === "workspace" && !auth.isBuilder()) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "app_auth_error",
            message: "Only builders can modify workspace assistants.",
          },
        });
      }
      if (
        assistantToPatch.scope !== "private" &&
        bodyValidation.right.assistant.scope === "private"
      ) {
        return apiError(req, res, {
          status_code: 400,
          api_error: {
            type: "invalid_request_error",
            message: "Non-private assistants cannot be set back to private.",
          },
        });
      }
      const agentConfiguration = await createOrUpgradeAgentConfiguration(
        auth,
        bodyValidation.right,
        req.query.aId as string
      );

      return res.status(200).json({
        agentConfiguration: agentConfiguration,
      });
    case "DELETE":
      const assistantToDelete = await getAgentConfiguration(
        auth,
        req.query.aId as string
      );
      if (
        !assistantToDelete ||
        (assistantToDelete.scope === "private" &&
          assistantToDelete.versionAuthorId !== auth.user()?.id)
      ) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "agent_configuration_not_found",
            message: "The Assistant you're trying to patch was not found.",
          },
        });
      }
      if (assistantToDelete.scope === "workspace" && !auth.isBuilder()) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "app_auth_error",
            message: "Only builders can modify workspace assistants.",
          },
        });
      }
      const archived = await archiveAgentConfiguration(
        auth,
        req.query.aId as string
      );
      if (!archived) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "agent_configuration_not_found",
            message: "The Assistant you're trying to delete was not found.",
          },
        });
      }
      return res.status(200).json({ success: true });

    default:
      return apiError(req, res, {
        status_code: 405,
        api_error: {
          type: "method_not_supported_error",
          message:
            "The method passed is not supported, GET or PATCH or DELETE is expected.",
        },
      });
  }
}

export default withLogging(handler);
