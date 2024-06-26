import type {
  ConnectorType,
  Result,
  WithConnectorsAPIErrorReponse,
} from "@dust-tt/types";
import {
  assertNever,
  ConnectorCreateRequestBodySchema,
  ioTsParsePayload,
  isConnectorProvider,
  WebCrawlerConfigurationTypeSchema,
} from "@dust-tt/types";
import type { Request, Response } from "express";
import { isLeft } from "fp-ts/lib/Either";
import * as reporter from "io-ts-reporters";

import { CREATE_CONNECTOR_BY_TYPE } from "@connectors/connectors";
import { errorFromAny } from "@connectors/lib/error";
import logger from "@connectors/logger/logger";
import { apiError, withLogging } from "@connectors/logger/withlogging";
import { ConnectorResource } from "@connectors/resources/connector_resource";

type ConnectorCreateResBody = WithConnectorsAPIErrorReponse<ConnectorType>;

const _createConnectorAPIHandler = async (
  req: Request<{ connector_provider: string }, ConnectorCreateResBody>,
  res: Response<ConnectorCreateResBody>
) => {
  try {
    const bodyValidation = ConnectorCreateRequestBodySchema.decode(req.body);
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

    if (!isConnectorProvider(req.params.connector_provider)) {
      return apiError(req, res, {
        status_code: 400,
        api_error: {
          type: "unknown_connector_provider",
          message: `Unknown connector provider ${req.params.connector_provider}`,
        },
      });
    }

    const {
      workspaceAPIKey,
      dataSourceName,
      workspaceId,
      connectionId,
      configuration,
    } = bodyValidation.right;

    let connectorRes: Result<string, Error> | null = null;
    null;
    switch (req.params.connector_provider) {
      case "webcrawler": {
        const connectorCreator =
          CREATE_CONNECTOR_BY_TYPE[req.params.connector_provider];
        const configurationRes = ioTsParsePayload(
          configuration,
          WebCrawlerConfigurationTypeSchema
        );
        if (configurationRes.isErr()) {
          return apiError(req, res, {
            status_code: 400,
            api_error: {
              type: "invalid_request_error",
              message: `Invalid request body: ${configurationRes.error}`,
            },
          });
        }
        connectorRes = await connectorCreator(
          {
            workspaceAPIKey: workspaceAPIKey,
            dataSourceName: dataSourceName,
            workspaceId: workspaceId,
          },
          connectionId,
          configurationRes.value
        );
        break;
      }

      case "github":
      case "notion":
      case "confluence":
      case "google_drive":
      case "intercom":
      case "microsoft":
      case "slack": {
        const connectorCreator =
          CREATE_CONNECTOR_BY_TYPE[req.params.connector_provider];
        connectorRes = await connectorCreator(
          {
            workspaceAPIKey: workspaceAPIKey,
            dataSourceName: dataSourceName,
            workspaceId: workspaceId,
          },
          connectionId,
          null
        );
        break;
      }
      default:
        assertNever(req.params.connector_provider);
    }

    if (connectorRes.isErr()) {
      return apiError(req, res, {
        status_code: 500,
        api_error: {
          type: "internal_server_error",
          message: connectorRes.error.message,
        },
      });
    }

    const connector = await ConnectorResource.fetchById(connectorRes.value);

    if (!connector) {
      return apiError(req, res, {
        status_code: 500,
        api_error: {
          type: "internal_server_error",
          message: `Created connector not found in database. Connector id: ${connectorRes.value}`,
        },
      });
    }

    return res.status(200).json(connector.toJSON());
  } catch (e) {
    logger.error(errorFromAny(e), "Error in createConnectorAPIHandler");
    return apiError(req, res, {
      status_code: 500,
      api_error: {
        type: "internal_server_error",
        message: "An unexpected error occured while creating the connector.",
      },
    });
  }
};

export const createConnectorAPIHandler = withLogging(
  _createConnectorAPIHandler
);
