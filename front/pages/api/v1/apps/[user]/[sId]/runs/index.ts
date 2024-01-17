import type { RunType } from "@dust-tt/types";
import type { ReturnedAPIErrorType } from "@dust-tt/types";
import type { NextApiRequest, NextApiResponse } from "next";

import logger from "@app/logger/logger";
import { apiError, statsDClient, withLogging } from "@app/logger/withlogging";
import { legacyUserToWorkspace } from "@app/pages/api/v1/legacy_user_to_workspace";
import wIdHandler from "@app/pages/api/v1/w/[wId]/apps/[aId]/runs/index";

export type PostRunResponseBody = {
  run: RunType;
};

export const config = {
  api: {
    responseLimit: "8mb",
  },
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PostRunResponseBody | ReturnedAPIErrorType>
): Promise<void> {
  const wId = legacyUserToWorkspace[req.query.user as string];
  if (!wId) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "user_not_found",
        message:
          "The legacy user you're trying to query was not found (check out our docs for updated workspace based URLs).",
      },
    });
  }

  logger.info(
    {
      user: req.query.user,
      wId,
      aId: req.query.sId,
      url: req.url,
    },
    "Legacy user to workspace rewrite"
  );

  const tags = [
    `method:${req.method}`,
    // `url:${req.url}`,
    `user:${req.query.user}`,
    `wId:${wId}`,
    `aId:${req.query.sId}`,
  ];

  statsDClient.increment("legacyAPIUser.rewrite", 1, tags);

  req.query.wId = wId;
  req.query.aId = req.query.sId;

  return wIdHandler(req, res);
}

export default withLogging(handler);
