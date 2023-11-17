import { NextApiRequest, NextApiResponse } from "next";

import { getDataSource } from "@app/lib/api/data_sources";
import { Authenticator, getAPIKey } from "@app/lib/auth";
import { CoreAPI, CoreAPIDatabaseSchema } from "@app/lib/core_api";
import { isDevelopmentOrDustWorkspace } from "@app/lib/development";
import logger from "@app/logger/logger";
import { apiError, withLogging } from "@app/logger/withlogging";

type GetDatabaseSchemaResponseBody = {
  schema: CoreAPIDatabaseSchema;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetDatabaseSchemaResponseBody>
): Promise<void> {
  const keyRes = await getAPIKey(req);
  if (keyRes.isErr()) {
    return apiError(req, res, keyRes.error);
  }

  const { auth } = await Authenticator.fromKey(
    keyRes.value,
    req.query.wId as string
  );

  const owner = auth.workspace();
  const plan = auth.plan();
  if (!owner || !plan) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "workspace_not_found",
        message: "The workspace you requested was not found.",
      },
    });
  }

  if (!isDevelopmentOrDustWorkspace(owner)) {
    res.status(404).end();
    return;
  }

  const dataSource = await getDataSource(auth, req.query.name as string);
  if (!dataSource) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "data_source_not_found",
        message: "The data source you requested was not found.",
      },
    });
  }

  const databaseId = req.query.id;
  if (!databaseId || typeof databaseId !== "string") {
    return apiError(req, res, {
      status_code: 400,
      api_error: {
        type: "invalid_request_error",
        message: "Invalid request query: id is required.",
      },
    });
  }

  switch (req.method) {
    case "GET":
      const schemaRes = await CoreAPI.getDatabaseSchema({
        projectId: dataSource.dustAPIProjectId,
        dataSourceName: dataSource.name,
        databaseId,
      });
      if (schemaRes.isErr()) {
        logger.error(
          {
            dataSourceName: dataSource.name,
            workspaceId: owner.id,
            databaseId,
            error: schemaRes.error,
          },
          "Failed to get database schema."
        );
        return apiError(req, res, {
          status_code: 500,
          api_error: {
            type: "internal_server_error",
            message: "Failed to get database schema.",
          },
        });
      }

      const { schema } = schemaRes.value;

      return res.status(200).json({ schema });

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

export default withLogging(handler);
