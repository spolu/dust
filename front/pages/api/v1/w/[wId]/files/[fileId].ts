import type { FileUploadedRequestResponseType } from "@dust-tt/client";
import type { WithAPIErrorResponse } from "@dust-tt/types";
import type { NextApiRequest, NextApiResponse } from "next";

import { processAndStoreFile } from "@app/lib/api/files/upload";
import { withPublicAPIAuthentication } from "@app/lib/api/wrappers";
import type { Authenticator } from "@app/lib/auth";
import type { FileVersion } from "@app/lib/resources/file_resource";
import { FileResource } from "@app/lib/resources/file_resource";
import { apiError } from "@app/logger/withlogging";

export const config = {
  api: {
    bodyParser: false, // Disabling Next.js's body parser as formidable has its own.
  },
};

const validActions = ["view", "download"] as const;
type Action = (typeof validActions)[number];

const VALID_GET_VERSIONS: FileVersion[] = [
  "original",
  "processed",
  "public",
  "snippet",
];

/**
 * @ignoreswagger
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WithAPIErrorResponse<FileUploadedRequestResponseType>>,
  auth: Authenticator
): Promise<void> {
  const { fileId } = req.query;
  if (typeof fileId !== "string") {
    return apiError(req, res, {
      status_code: 400,
      api_error: {
        type: "invalid_request_error",
        message: "Missing fileId query parameter.",
      },
    });
  }

  const file = await FileResource.fetchById(auth, fileId);
  if (!file) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "file_not_found",
        message: "File not found.",
      },
    });
  }

  switch (req.method) {
    case "GET": {
      const action: Action = validActions.includes(req.query.action as Action)
        ? (req.query.action as Action)
        : "download";

      if (action === "view") {
        // Only allow version parameter if the action is view.
        const version: FileVersion = VALID_GET_VERSIONS.includes(
          req.query.version as FileVersion
        )
          ? (req.query.version as FileVersion)
          : "original";

        const readStream = file.getReadStream({
          auth,
          version,
        });
        readStream.on("error", () => {
          return apiError(req, res, {
            status_code: 404,
            api_error: {
              type: "file_not_found",
              message: "File not found.",
            },
          });
        });
        res.setHeader("Content-Type", file.contentType);
        readStream.pipe(res);
        return;
      }

      // Redirect to a signed URL.
      const url = await file.getSignedUrlForDownload(auth, "original");

      res.redirect(url);
      return;
    }

    case "DELETE": {
      const deleteRes = await file.delete(auth);
      if (deleteRes.isErr()) {
        return apiError(req, res, {
          status_code: 400,
          api_error: {
            type: "invalid_request_error",
            message: "Failed to delete the file.",
          },
        });
      }

      res.status(204).end();
      return;
    }

    case "POST": {
      const r = await processAndStoreFile(auth, { file, req });

      if (r.isErr()) {
        return apiError(req, res, {
          status_code: r.error.code == "internal_server_error" ? 500 : 400,
          api_error: {
            type: r.error.code,
            message: r.error.message,
          },
        });
      } else {
        return res.status(200).json({ file: file.toPublicJSON(auth) });
      }
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

export default withPublicAPIAuthentication(handler, {
  requiredScopes: {
    GET: "read:file",
    POST: "create:file",
    DELETE: "delete:file",
  },
});
