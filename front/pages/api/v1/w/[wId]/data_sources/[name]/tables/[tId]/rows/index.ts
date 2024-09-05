import type {
  CoreAPIRow,
  CoreAPITableSchema,
  WithAPIErrorResponse,
} from "@dust-tt/types";
import { CoreAPI, isSlugified } from "@dust-tt/types";
import { isLeft } from "fp-ts/lib/Either";
import * as t from "io-ts";
import * as reporter from "io-ts-reporters";
import type { NextApiRequest, NextApiResponse } from "next";

import config from "@app/lib/api/config";
import { getDataSource } from "@app/lib/api/data_sources";
import { Authenticator, getAPIKey } from "@app/lib/auth";
import logger from "@app/logger/logger";
import { apiError, withLogging } from "@app/logger/withlogging";

const UpsertTableRowsRequestBodySchema = t.type({
  rows: t.array(
    t.type({
      row_id: t.string,
      value: t.record(
        t.string,
        t.union([
          t.string,
          t.null,
          t.number,
          t.boolean,
          t.type({
            type: t.literal("datetime"),
            epoch: t.number,
          }),
        ])
      ),
    })
  ),
  truncate: t.union([t.boolean, t.undefined]),
});

type CellValueType = t.TypeOf<
  typeof UpsertTableRowsRequestBodySchema
>["rows"][number]["value"][string];

type UpsertTableRowsResponseBody = {
  table: {
    name: string;
    table_id: string;
    description: string;
    schema: CoreAPITableSchema | null;
  };
};

type ListTableRowsResponseBody = {
  rows: CoreAPIRow[];
  offset: number;
  limit: number;
  total: number;
};

/**
 * @swagger
 * /api/v1/w/{wId}/data_sources/{name}/tables/{tId}/rows:
 *  get:
 *    summary: List rows
 *    description: List rows in the table identified by {tId} in the data source identified by {name} in the workspace identified by {wId}.
 *    tags:
 *      - Datasources
 *    security:
 *      - BearerAuth: []
 *    parameters:
 *      - in: path
 *        name: wId
 *        required: true
 *        description: Unique string identifier for the workspace
 *        schema:
 *          type: string
 *      - in: path
 *        name: name
 *        required: true
 *        description: Name of the data source
 *        schema:
 *          type: string
 *      - in: path
 *        name: tId
 *        required: true
 *        description: ID of the table
 *        schema:
 *          type: string
 *      - in: query
 *        name: limit
 *        description: Limit the number of rows returned
 *        schema:
 *          type: integer
 *      - in: query
 *        name: offset
 *        description: Offset the returned rows
 *        schema:
 *          type: integer
 *    responses:
 *      200:
 *        description: The rows
 *        content:
 *          application/json:
 *            schema:
 *              type: array
 *              items:
 *                $ref: '#/components/schemas/Datasource'
 *      405:
 *        description: Method not supported
 *  post:
 *    summary: Upsert rows
 *    description: Upsert rows in the table identified by {tId} in the data source identified by {name} in the workspace identified by {wId}.
 *    tags:
 *      - Datasources
 *    security:
 *      - BearerAuth: []
 *    parameters:
 *      - in: path
 *        name: wId
 *        required: true
 *        description: Unique string identifier for the workspace
 *        schema:
 *          type: string
 *      - in: path
 *        name: name
 *        required: true
 *        description: Name of the data source
 *        schema:
 *          type: string
 *      - in: path
 *        name: tId
 *        required: true
 *        description: ID of the table
 *        schema:
 *          type: string
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              rows:
 *                type: array
 *                items:
 *                  type: object
 *                  properties:
 *                    row_id:
 *                      type: string
 *                      description: Unique identifier for the row
 *                    value:
 *                      type: object
 *                      additionalProperties:
 *                        oneOf:
 *                          - type: string
 *                          - type: number
 *                          - type: boolean
 *                          - type: object
 *                            properties:
 *                              type:
 *                                type: string
 *                                enum:
 *                                  - datetime
 *                              epoch:
 *                                type: number
 *              truncate:
 *                type: boolean
 *                description: Whether to truncate existing rows
 *    responses:
 *      200:
 *        description: The table
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/Datasource'
 *      400:
 *        description: Bad Request. Missing or invalid parameters.
 *      401:
 *        description: Unauthorized. Invalid or missing authentication token.
 *      500:
 *        description: Internal Server Error.
 *      404:
 *        description: Data source or workspace not found.
 *      405:
 *        description: Method not supported.
 */

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    WithAPIErrorResponse<
      UpsertTableRowsResponseBody | ListTableRowsResponseBody
    >
  >
): Promise<void> {
  const keyRes = await getAPIKey(req);
  if (keyRes.isErr()) {
    return apiError(req, res, keyRes.error);
  }

  const { workspaceAuth } = await Authenticator.fromKey(
    keyRes.value,
    req.query.wId as string
  );

  const owner = workspaceAuth.workspace();
  const plan = workspaceAuth.plan();
  if (!owner || !plan || !workspaceAuth.isBuilder()) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "data_source_not_found",
        message: "The data source you requested was not found.",
      },
    });
  }

  const dataSource = await getDataSource(
    workspaceAuth,
    req.query.name as string
  );
  if (!dataSource) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "data_source_not_found",
        message: "The data source you requested was not found.",
      },
    });
  }

  const tableId = req.query.tId;
  if (typeof tableId !== "string") {
    return apiError(req, res, {
      status_code: 400,
      api_error: {
        type: "invalid_request_error",
        message: "The table id is missing.",
      },
    });
  }
  const coreAPI = new CoreAPI(config.getCoreAPIConfig(), logger);
  switch (req.method) {
    case "GET":
      const limit =
        typeof req.query.limit === "string" ? parseInt(req.query.limit) : 10;
      const offset =
        typeof req.query.offset === "string" ? parseInt(req.query.offset) : 0;

      const listRes = await coreAPI.getTableRows({
        projectId: dataSource.dustAPIProjectId,
        dataSourceId: dataSource.dustAPIDataSourceId,
        tableId,
        offset,
        limit,
      });

      if (listRes.isErr()) {
        logger.error(
          {
            dataSourceName: dataSource.name,
            workspaceId: owner.id,
            tableId: tableId,
            error: listRes.error,
          },
          "Failed to list database rows."
        );

        return apiError(req, res, {
          status_code: 500,
          api_error: {
            type: "internal_server_error",
            message: "Failed to list database rows.",
          },
        });
      }

      const { rows: rowsList, total } = listRes.value;
      return res.status(200).json({ rows: rowsList, offset, limit, total });

    case "POST":
      const bodyValidation = UpsertTableRowsRequestBodySchema.decode(req.body);
      if (isLeft(bodyValidation)) {
        const pathError = reporter.formatValidationErrors(bodyValidation.left);
        return apiError(req, res, {
          api_error: {
            type: "invalid_request_error",
            message: `Invalid request body: ${pathError}`,
          },
          status_code: 400,
        });
      }
      const { truncate } = bodyValidation.right;
      let { rows: rowsToUpsert } = bodyValidation.right;

      // Make sure every key in the rows are lowercase
      const allKeys = new Set(
        rowsToUpsert.map((row) => Object.keys(row.value)).flat()
      );
      if (!Array.from(allKeys).every(isSlugified)) {
        return apiError(req, res, {
          status_code: 400,
          api_error: {
            type: "invalid_request_error",
            message:
              "Invalid request body: keys must be lowercase alphanumeric.",
          },
        });
      }

      rowsToUpsert = rowsToUpsert.map((row) => {
        const value: Record<string, CellValueType> = {};
        for (const [key, val] of Object.entries(row.value)) {
          value[key.toLowerCase()] = val;
        }
        return { row_id: row.row_id, value };
      });
      const upsertRes = await coreAPI.upsertTableRows({
        projectId: dataSource.dustAPIProjectId,
        dataSourceId: dataSource.dustAPIDataSourceId,
        tableId: tableId,
        rows: rowsToUpsert,
        truncate,
      });

      if (upsertRes.isErr()) {
        logger.error(
          {
            dataSourceName: dataSource.name,
            workspaceId: owner.id,
            tableId: tableId,
            error: upsertRes.error,
          },
          "Failed to upsert database rows."
        );

        return apiError(req, res, {
          status_code: 500,
          api_error: {
            type: "internal_server_error",
            message: "Failed to upsert database rows.",
          },
        });
      }

      // Upsert is succesful, retrieve the updated table.
      const tableRes = await coreAPI.getTable({
        projectId: dataSource.dustAPIProjectId,
        dataSourceId: dataSource.dustAPIDataSourceId,
        tableId,
      });
      if (tableRes.isErr()) {
        logger.error(
          {
            dataSourcename: dataSource.name,
            workspaceId: owner.id,
            error: tableRes.error,
          },
          "Failed to retrieve updated table."
        );
        return apiError(req, res, {
          status_code: 500,
          api_error: {
            type: "internal_server_error",
            message: "Failed to get table.",
          },
        });
      }

      const { table } = tableRes.value;

      return res.status(200).json({
        table: {
          name: table.name,
          table_id: table.table_id,
          description: table.description,
          schema: table.schema,
        },
      });

    default:
      return apiError(req, res, {
        status_code: 405,
        api_error: {
          type: "method_not_supported_error",
          message: "The method passed is not supported, GET, POST is expected.",
        },
      });
  }
}

export default withLogging(handler);
