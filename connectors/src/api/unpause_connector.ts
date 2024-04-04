import type { WithConnectorsAPIErrorReponse } from "@dust-tt/types";
import type { Request, Response } from "express";

import { UNPAUSE_CONNECTOR_BY_TYPE } from "@connectors/connectors";
import { errorFromAny } from "@connectors/lib/error";
import logger from "@connectors/logger/logger";
import { apiError, withLogging } from "@connectors/logger/withlogging";
import { ConnectorResource } from "@connectors/resources/connector_resource";

type ConnectorUnpauseResBody = WithConnectorsAPIErrorReponse<{
  connectorId: string;
}>;

const _unpauseConnectorAPIHandler = async (
  req: Request<{ connector_id: string }, ConnectorUnpauseResBody>,
  res: Response<ConnectorUnpauseResBody>
) => {
  try {
    const connector = await ConnectorResource.fetchById(
      req.params.connector_id
    );
    if (!connector) {
      return apiError(req, res, {
        api_error: {
          type: "connector_not_found",
          message: "Connector not found",
        },
        status_code: 404,
      });
    }
    const connectorUnpauser = UNPAUSE_CONNECTOR_BY_TYPE[connector.type];

    const unpauseRes = await connectorUnpauser(connector.id);

    if (unpauseRes.isErr()) {
      return apiError(req, res, {
        status_code: 500,
        api_error: {
          type: "internal_server_error",
          message: unpauseRes.error.message,
        },
      });
    }

    return res.sendStatus(204);
  } catch (e) {
    logger.error(errorFromAny(e), "Failed to unpause the connector");
    return apiError(req, res, {
      status_code: 500,
      api_error: {
        type: "internal_server_error",
        message: "Could not unpause the connector",
      },
    });
  }
};

export const unpauseConnectorAPIHandler = withLogging(
  _unpauseConnectorAPIHandler
);
