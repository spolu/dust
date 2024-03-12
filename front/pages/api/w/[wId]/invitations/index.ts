import type {
  MembershipInvitationType,
  WithAPIErrorReponse,
} from "@dust-tt/types";
import type { NextApiRequest, NextApiResponse } from "next";

import { sendWorkspaceInvitationEmail } from "@app/lib/api/invitation";
import {
  checkWorkspaceSeatAvailabilityUsingAuth,
  getPendingInvitations,
} from "@app/lib/api/workspace";
import { Authenticator, getSession } from "@app/lib/auth";
import { isEmailValid } from "@app/lib/utils";
import { apiError, withLogging } from "@app/logger/withlogging";

const { SENDGRID_API_KEY = "", URL, DUST_INVITE_TOKEN_SECRET } = process.env;

export type GetWorkspaceInvitationsResponseBody = {
  invitations: MembershipInvitationType[];
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WithAPIErrorReponse<GetWorkspaceInvitationsResponseBody>>
): Promise<void> {
  const session = await getSession(req, res);
  const auth = await Authenticator.fromSession(
    session,
    req.query.wId as string
  );

  const owner = auth.workspace();
  const user = auth.user();
  if (!owner || !user) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "workspace_not_found",
        message: "The workspace was not found.",
      },
    });
  }

  if (!auth.isAdmin()) {
    return apiError(req, res, {
      status_code: 403,
      api_error: {
        type: "workspace_auth_error",
        message:
          "Only users that are `admins` for the current workspace can see membership invitations or modify it.",
      },
    });
  }

  const subscription = auth.subscription();
  const plan = auth.plan();
  if (!subscription || !plan) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "workspace_auth_error",
        message: "The subscription was not found.",
      },
    });
  }

  switch (req.method) {
    case "GET":
      const invitations = await getPendingInvitations(auth);
      res.status(200).json({ invitations });
      return;

    case "POST":
      if (
        !req.body ||
        !typeof (req.body.inviteEmail === "string") ||
        !isEmailValid(req.body.inviteEmail)
      ) {
        return apiError(req, res, {
          status_code: 400,
          api_error: {
            type: "invalid_request_error",
            message: "The request body is invalid, expects { email: string }.",
          },
        });
      }

      const hasAvailableSeats = await checkWorkspaceSeatAvailabilityUsingAuth(
        auth
      );
      if (!hasAvailableSeats) {
        return apiError(req, res, {
          status_code: 400,
          api_error: {
            type: "plan_limit_error",
            message:
              "Workspace has reached its member limit. Please upgrade or remove inactive members to add more.",
          },
        });
      }

      if (!URL) {
        throw new Error("URL is not set");
      }
      if (!DUST_INVITE_TOKEN_SECRET) {
        throw new Error("DUST_INVITE_TOKEN_SECRET is not set");
      }

      if (subscription.paymentFailingSince) {
        return apiError(req, res, {
          status_code: 402,
          api_error: {
            type: "subscription_payment_failed",
            message:
              "The subscription payment has failed, impossible to add new members.",
          },
        });
      }

      const invitation = await sendWorkspaceInvitationEmail(
        owner,
        user,
        req.body.inviteEmail
      );

      res.status(200).json({
        invitations: [
          {
            id: invitation.id,
            status: invitation.status,
            inviteEmail: invitation.inviteEmail,
          },
        ],
      });
      return;

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
