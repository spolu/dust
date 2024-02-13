import type { LightWorkspaceType, WithAPIErrorReponse } from "@dust-tt/types";
import type { NextApiRequest, NextApiResponse } from "next";
import type { FindOptions, WhereOptions } from "sequelize";
import { Op } from "sequelize";

import { Authenticator, getSession } from "@app/lib/auth";
import { Subscription, Workspace } from "@app/lib/models";
import { apiError, withLogging } from "@app/logger/withlogging";

export type GetWorkspacesResponseBody = {
  workspaces: LightWorkspaceType[];
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WithAPIErrorReponse<GetWorkspacesResponseBody>>
): Promise<void> {
  const session = await getSession(req, res);
  const auth = await Authenticator.fromSuperUserSession(session, null);

  if (!auth.isDustSuperUser()) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "user_not_found",
        message: "Could not find the user.",
      },
    });
  }

  switch (req.method) {
    case "GET":
      let upgraded: boolean | undefined;
      const search = req.query.search
        ? (req.query.search as string).trim()
        : undefined;
      let limit: number | undefined;

      if (req.query.upgraded !== undefined) {
        if (
          typeof req.query.upgraded !== "string" ||
          !["true", "false"].includes(req.query.upgraded)
        ) {
          return apiError(req, res, {
            status_code: 400,
            api_error: {
              type: "invalid_request_error",
              message:
                "The request query is invalid, expects { upgraded: boolean }.",
            },
          });
        }

        upgraded = req.query.upgraded === "true";
      }

      if (search !== undefined && typeof search !== "string") {
        return apiError(req, res, {
          status_code: 400,
          api_error: {
            type: "invalid_request_error",
            message:
              "The request query is invalid, expects { search: string }.",
          },
        });
      }

      if (req.query.limit !== undefined) {
        if (
          typeof req.query.limit !== "string" ||
          !/^\d+$/.test(req.query.limit)
        ) {
          return apiError(req, res, {
            status_code: 400,
            api_error: {
              type: "invalid_request_error",
              message:
                "The request query is invalid, expects { limit: number }.",
            },
          });
        }

        limit = parseInt(req.query.limit, 10);
      }

      const conditions: WhereOptions<Workspace>[] = [];

      if (upgraded !== undefined) {
        const subscriptions = await Subscription.findAll({
          where: {
            status: "active",
          },
          attributes: ["workspaceId"],
        });
        const workspaceIds = subscriptions.map((s) => s.workspaceId);
        if (upgraded) {
          conditions.push({
            id: {
              [Op.in]: workspaceIds,
            },
          });
        } else {
          conditions.push({
            id: {
              [Op.notIn]: workspaceIds,
            },
          });
        }
      }

      if (search) {
        conditions.push({
          [Op.or]: [
            {
              sId: {
                [Op.iLike]: `${search}%`,
              },
            },
            {
              name: {
                [Op.iLike]: `${search}%`,
              },
            },
          ],
        });
      }

      const where: FindOptions<Workspace>["where"] = conditions.length
        ? {
            [Op.and]: conditions,
          }
        : {};

      const workspaces = await Workspace.findAll({ where, limit });

      return res.status(200).json({
        workspaces: workspaces.map((ws) => ({
          id: ws.id,
          sId: ws.sId,
          name: ws.name,
          role: "admin",
          segmentation: ws.segmentation,
        })),
      });
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
