import { Storage } from "@google-cloud/storage";
import { NextApiRequest, NextApiResponse } from "next";

import { getSession, getUserFromSession } from "@app/lib/auth";
import { ConnectorsAPI } from "@app/lib/connectors_api";
import { CoreAPI } from "@app/lib/core_api";
import { ReturnedAPIErrorType } from "@app/lib/error";
import { DataSource, Workspace } from "@app/lib/models";
import { apiError, withLogging } from "@app/logger/withlogging";

const { DUST_DATA_SOURCES_BUCKET = "", SERVICE_ACCOUNT } = process.env;

export type DeleteDataSourceResponseBody = {
  success: true;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DeleteDataSourceResponseBody | ReturnedAPIErrorType>
): Promise<void> {
  const session = await getSession(req, res);
  const user = await getUserFromSession(session);

  if (!user) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "user_not_found",
        message: "Could not find the user.",
      },
    });
  }

  if (!user.isDustSuperUser) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "user_not_found",
        message: "Could not find the user.",
      },
    });
  }

  switch (req.method) {
    case "DELETE":
      if (!SERVICE_ACCOUNT) {
        return apiError(req, res, {
          status_code: 500,
          api_error: {
            type: "internal_server_error",
            message: "Could not find the service account for GCP.",
          },
        });
      }

      const { wId } = req.query;
      if (!wId || typeof wId !== "string") {
        return apiError(req, res, {
          status_code: 400,
          api_error: {
            type: "invalid_request_error",
            message:
              "The request query is invalid, expects { workspaceId: string }.",
          },
        });
      }

      const { name } = req.query;
      if (!name || typeof name !== "string") {
        return apiError(req, res, {
          status_code: 400,
          api_error: {
            type: "invalid_request_error",
            message: "The request query is invalid, expects { name: string }.",
          },
        });
      }

      const workspace = await Workspace.findOne({
        where: {
          sId: wId,
        },
      });

      if (!workspace) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "workspace_not_found",
            message: "Could not find the workspace.",
          },
        });
      }

      const dataSource = await DataSource.findOne({
        where: {
          workspaceId: workspace.id,
          name,
        },
      });

      if (!dataSource) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "data_source_not_found",
            message: "Could not find the data source.",
          },
        });
      }

      const dustAPIProjectId = dataSource.dustAPIProjectId;

      if (dataSource.connectorId) {
        await ConnectorsAPI.deleteConnector(
          dataSource.connectorId.toString(),
          true
        );
      }

      await CoreAPI.deleteDataSource({
        projectId: dustAPIProjectId,
        dataSourceName: dataSource.name,
      });

      await dataSource.destroy();

      const storage = new Storage({ keyFilename: SERVICE_ACCOUNT });

      const [files] = await storage
        .bucket(DUST_DATA_SOURCES_BUCKET)
        .getFiles({ prefix: dustAPIProjectId });

      const chunkSize = 32;
      const chunks = [];
      for (let i = 0; i < files.length; i += chunkSize) {
        chunks.push(files.slice(i, i + chunkSize));
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk) {
          continue;
        }
        await Promise.all(
          chunk.map((f) => {
            return (async () => {
              console.log(`Deleting file: ${f.name}`);
              await f.delete();
            })();
          })
        );
      }

      return res.status(200).json({ success: true });

    default:
      return apiError(req, res, {
        status_code: 405,
        api_error: {
          type: "method_not_supported_error",
          message: "The method passed is not supported, DELETE is expected.",
        },
      });
  }
}

export default withLogging(handler);
