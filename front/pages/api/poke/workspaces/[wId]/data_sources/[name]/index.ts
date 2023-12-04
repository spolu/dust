import { NextApiRequest, NextApiResponse } from "next";

import { Authenticator, getSession } from "@app/lib/auth";
import { ConnectorsAPI } from "@app/lib/connectors_api";
import { CoreAPI } from "@app/lib/core_api";
import { ReturnedAPIErrorType } from "@app/lib/error";
import { DataSource } from "@app/lib/models";
import { apiError, withLogging } from "@app/logger/withlogging";
import { launchScrubDataSourceWorkflow } from "@app/poke/temporal/client";

export type DeleteDataSourceResponseBody = {
  success: true;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DeleteDataSourceResponseBody | ReturnedAPIErrorType>
): Promise<void> {
  const session = await getSession(req, res);
  const auth = await Authenticator.fromSuperUserSession(
    session,
    req.query.wId as string
  );
  const user = auth.user();
  const owner = auth.workspace();

  if (!user || !owner || !auth.isDustSuperUser()) {
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

      const dataSource = await DataSource.findOne({
        where: {
          workspaceId: owner.id,
          name: req.query.name as string,
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
        const connDeleteRes = await ConnectorsAPI.deleteConnector(
          dataSource.connectorId.toString(),
          true
        );
        if (connDeleteRes.isErr()) {
          // If we get a not found we proceed with the deletion of the data source. This will enable
          // us to retry deletion of the data source if it fails at the Core level.
          if (connDeleteRes.error.error.type !== "connector_not_found") {
            return apiError(req, res, {
              status_code: 500,
              api_error: {
                type: "internal_server_error",
                message: `Error deleting connector: ${connDeleteRes.error.error.message}`,
              },
            });
          }
        }
      }

      const coreDeleteRes = await CoreAPI.deleteDataSource({
        projectId: dustAPIProjectId,
        dataSourceName: dataSource.name,
      });
      if (coreDeleteRes.isErr()) {
        return apiError(req, res, {
          status_code: 500,
          api_error: {
            type: "internal_server_error",
            message: `Error deleting core data source: ${coreDeleteRes.error.message}`,
          },
        });
      }

      await dataSource.destroy();

      await launchScrubDataSourceWorkflow({
        wId: owner.sId,
        dustAPIProjectId,
      });

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
