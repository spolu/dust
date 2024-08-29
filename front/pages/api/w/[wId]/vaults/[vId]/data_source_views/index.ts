import type {
  ConnectorType,
  DataSourceViewType,
  DataSourceViewWithConnectorType,
  WithAPIErrorResponse,
} from "@dust-tt/types";
import {
  ConnectorsAPI,
  isManaged,
  PostDataSourceViewSchema,
} from "@dust-tt/types";
import { isLeft } from "fp-ts/lib/Either";
import * as reporter from "io-ts-reporters";
import type { NextApiRequest, NextApiResponse } from "next";

import config from "@app/lib/api/config";
import { withSessionAuthenticationForWorkspace } from "@app/lib/api/wrappers";
import type { Authenticator } from "@app/lib/auth";
import { DataSourceResource } from "@app/lib/resources/data_source_resource";
import { DataSourceViewResource } from "@app/lib/resources/data_source_view_resource";
import { VaultResource } from "@app/lib/resources/vault_resource";
import logger from "@app/logger/logger";
import { apiError } from "@app/logger/withlogging";

export type GetVaultDataSourceViewWithConnectorsResponseBody = {
  dataSourceViews: DataSourceViewWithConnectorType[];
};

export type GetVaultDataSourceViewsResponseBody = {
  dataSourceViews: DataSourceViewType[];
};

export type PostVaultDataSourceViewsResponseBody = {
  dataSourceView: DataSourceViewType;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    WithAPIErrorResponse<
      | GetVaultDataSourceViewsResponseBody
      | GetVaultDataSourceViewWithConnectorsResponseBody
      | PostVaultDataSourceViewsResponseBody
    >
  >,
  auth: Authenticator
): Promise<void> {
  const vault = await VaultResource.fetchById(auth, req.query.vId as string);

  if (
    !vault ||
    (!auth.isAdmin() && !auth.hasPermission([vault.acl()], "read"))
  ) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "vault_not_found",
        message: "The vault you requested was not found.",
      },
    });
  }

  switch (req.method) {
    case "GET": {
      const category =
        req.query.category && typeof req.query.category === "string"
          ? req.query.category
          : null;

      const dataSourceViews = (
        await DataSourceViewResource.listByVault(auth, vault)
      )
        .map((ds) => ds.toJSON())
        .filter((d) => !category || d.category === category);

      if (req.query.includeConnectorDetails) {
        const enhancedDataSourceViews = await Promise.all(
          dataSourceViews.map(async (dataSourceView) => {
            const dataSource = dataSourceView.dataSource;
            if (!isManaged(dataSource)) {
              return dataSourceView;
            }

            let connector: ConnectorType | null = null;
            let fetchConnectorError = false;
            let fetchConnectorErrorMessage: string | null = null;
            try {
              const connectorsAPI = new ConnectorsAPI(
                config.getConnectorsAPIConfig(),
                logger
              );
              const statusRes = await connectorsAPI.getConnector(
                dataSource.connectorId
              );
              if (statusRes.isErr()) {
                fetchConnectorError = true;
                fetchConnectorErrorMessage = statusRes.error.message;
              } else {
                connector = statusRes.value;
              }
            } catch (e) {
              // Probably means `connectors` is down, we don't fail to avoid a 500 when just displaying
              // the datasources (eventual actions will fail but a 500 just at display is not desirable).
              // When that happens the managed data sources are shown as failed.
              fetchConnectorError = true;
              fetchConnectorErrorMessage = "Synchonization service is down";
            }

            return {
              ...dataSourceView,
              dataSource: {
                ...dataSource,
                connectorProvider: dataSource.connectorProvider,
                connector,
                fetchConnectorError,
                fetchConnectorErrorMessage,
              },
            };
          })
        );
        return res.status(200).json({
          dataSourceViews: enhancedDataSourceViews,
        });
      }

      return res.status(200).json({
        dataSourceViews: dataSourceViews.filter(
          (d) => !category || d.category === category
        ),
      });
    }

    case "POST": {
      if (!auth.isAdmin() || !auth.isBuilder()) {
        // Only admins, or builders who have to the vault, can create a new view
        return apiError(req, res, {
          status_code: 403,
          api_error: {
            type: "workspace_auth_error",
            message:
              "Only users that are `admins` or `builder` can administrate vaults.",
          },
        });
      }

      const bodyValidation = PostDataSourceViewSchema.decode(req.body);
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

      const { name, parentsIn } = bodyValidation.right;

      // Create a new view
      const dataSource = await DataSourceResource.fetchByName(auth, name);
      if (!dataSource) {
        return apiError(req, res, {
          status_code: 400,
          api_error: {
            type: "invalid_request_error",
            message: `Invalid data source: ${name}`,
          },
        });
      }
      const existing = await DataSourceViewResource.listForDataSourcesInVault(
        auth,
        [dataSource],
        vault
      );
      if (existing.length > 0) {
        return apiError(req, res, {
          status_code: 400,
          api_error: {
            type: "invalid_request_error",
            message: `View already exists for data source: ${name}`,
          },
        });
      }
      const dataSourceView =
        await DataSourceViewResource.createViewInVaultFromDataSource(
          vault,
          dataSource,
          parentsIn
        );
      return res.status(201).json({
        dataSourceView: dataSourceView.toJSON(),
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

export default withSessionAuthenticationForWorkspace(handler);
