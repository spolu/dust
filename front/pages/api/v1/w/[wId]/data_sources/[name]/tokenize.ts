import type { CoreAPITokenType, WithAPIErrorResponse } from "@dust-tt/types";
import { CoreAPI } from "@dust-tt/types";
import { isLeft } from "fp-ts/lib/Either";
import * as t from "io-ts";
import * as reporter from "io-ts-reporters";
import type { NextApiRequest, NextApiResponse } from "next";

import config from "@app/lib/api/config";
import { getDataSource } from "@app/lib/api/data_sources";
import { withPublicApiAuthentication } from "@app/lib/api/wrappers";
import type { Authenticator } from "@app/lib/auth";
import logger from "@app/logger/logger";
import { apiError } from "@app/logger/withlogging";

export type PostDatasourceTokenizeBody = {
  text: string;
};

const PostDatasourceTokenizeBodySchema = t.type({
  text: t.string,
});

type PostDatasourceTokenizeResponseBody = {
  tokens: CoreAPITokenType[];
};

/**
 * @ignoreswagger
 * This endpoint is not to be included in the public API docs.
 */

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    WithAPIErrorResponse<PostDatasourceTokenizeResponseBody>
  >,
  auth: Authenticator
): Promise<void> {
  const { name } = req.query;
  if (typeof name !== "string") {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "data_source_not_found",
        message: "The data source you requested was not found.",
      },
    });
  }

  const dataSource = await getDataSource(auth, name);
  if (!dataSource) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "data_source_not_found",
        message: "The data source you requested was not found.",
      },
    });
  }

  switch (req.method) {
    case "POST": {
      const bodyValidation = PostDatasourceTokenizeBodySchema.decode(req.body);
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
      const text = bodyValidation.right.text;
      const coreAPI = new CoreAPI(config.getCoreAPIConfig(), logger);
      const coreTokenizeRes = await coreAPI.dataSourceTokenize({
        projectId: dataSource.dustAPIProjectId,
        dataSourceId: dataSource.dustAPIDataSourceId,
        text,
      });
      if (coreTokenizeRes.isErr()) {
        return apiError(req, res, {
          status_code: 500,
          api_error: {
            type: "internal_server_error",
            message: `Error tokenizing text: ${coreTokenizeRes.error.message}`,
            data_source_error: coreTokenizeRes.error,
          },
        });
      }
      const tokens = coreTokenizeRes.value.tokens;
      res.status(200).json({ tokens });
      return;
    }

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

export default withPublicApiAuthentication(handler);
