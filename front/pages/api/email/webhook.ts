import type { Result, WithAPIErrorReponse } from "@dust-tt/types";
import { Err, Ok } from "@dust-tt/types";
import { IncomingForm } from "formidable";
import type { NextApiRequest, NextApiResponse } from "next";

import {
  ASSISTANT_EMAIL_SUBDOMAIN,
  emailAnswer,
  emailAssistantMatcher,
  sendEmailAnswerOrError,
  userAndWorkspaceFromEmail,
} from "@app/lib/api/assistant/email_answer";
import { Authenticator } from "@app/lib/auth";
import { apiError, withLogging } from "@app/logger/withlogging";

const { EMAIL_WEBHOOK_SECRET = "" } = process.env;

export type PostResponseBody = {
  success: boolean;
};

export const config = {
  api: {
    bodyParser: false, // Disabling Next.js's body parser as formidable has its own
  },
};

// Parses the Sendgid webhook form data and validates it.
const parseSendgridWebhookContent = async (
  req: NextApiRequest
): Promise<
  Result<
    {
      subject: string;
      text: string;
      auth: { SPF: string; dkim: string };
      envelope: {
        to: string[];
        cc: string[];
        bcc: string[];
        from: string;
      };
    },
    Error
  >
> => {
  const form = new IncomingForm();
  const [fields] = await form.parse(req);

  try {
    const subject = fields["subject"] ? fields["subject"][0] : null;
    const text = fields["text"] ? fields["text"][0] : null;
    const SPF = fields["SPF"] ? fields["SPF"][0] : null;
    const dkim = fields["dkim"] ? fields["dkim"][0] : null;
    const envelope = fields["envelope"]
      ? JSON.parse(fields["envelope"][0])
      : null;

    if (!envelope) {
      return new Err(new Error("Failed to parse envelope"));
    }

    const from = envelope.from;

    if (!from || typeof from !== "string") {
      return new Err(new Error("Failed to parse envelope.from"));
    }

    return new Ok({
      subject: subject || "(no subject)",
      text: text || "",
      auth: { SPF: SPF || "", dkim: dkim || "" },
      envelope: {
        to: envelope.to || [],
        cc: envelope.cc || [],
        bcc: envelope.bcc || [],
        from,
      },
    });
  } catch (e) {
    return new Err(new Error("Failed to parse email content"));
  }
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WithAPIErrorReponse<PostResponseBody>>
): Promise<void> {
  switch (req.method) {
    case "POST":
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Basic ")) {
        return apiError(req, res, {
          status_code: 401,
          api_error: {
            type: "missing_authorization_header_error",
            message: "Missing Authorization header",
          },
        });
      }

      const base64Credentials = authHeader.split(" ")[1];
      const credentials = Buffer.from(base64Credentials, "base64").toString(
        "ascii"
      );
      const [username, password] = credentials.split(":");

      if (username !== "sendgrid" || password !== EMAIL_WEBHOOK_SECRET) {
        return apiError(req, res, {
          status_code: 403,
          api_error: {
            type: "invalid_basic_authorization_error",
            message: "Invalid Authorization header",
          },
        });
      }

      const emailRes = await parseSendgridWebhookContent(req);
      if (emailRes.isErr()) {
        return apiError(req, res, {
          status_code: 401,
          api_error: {
            type: "invalid_request_error",
            message: emailRes.error.message,
          },
        });
      }

      const email = emailRes.value;

      console.log("TEXT:\n```\n", email.text, "\n```");
      console.log("SUBJECT:\n```\n", email.subject, "\n```");

      // Check SPF is pass.
      if (
        email.auth.SPF !== "pass" ||
        email.auth.dkim !== `{@${email.envelope.from.split("@")[1]} : pass}`
      ) {
        return apiError(req, res, {
          status_code: 401,
          api_error: {
            type: "invalid_request_error",
            message: "SPF/dkim validation failed",
          },
        });
      }

      const userRes = await userAndWorkspaceFromEmail({
        email: email.envelope.from,
      });
      if (userRes.isErr()) {
        // TODO send email to explain problem
        return apiError(req, res, {
          status_code: 401,
          api_error: {
            type: "invalid_request_error",
            message: `Failed to retrieve user from email: ${userRes.error.type}}`,
          },
        });
      }

      const { user, workspace } = userRes.value;

      const auth = await Authenticator.internalUserForWorkspace({
        user,
        workspace,
      });

      // find target email in [...to, ...cc, ...bcc], that is email whose domain is
      // ASSISTANT_EMAIL_SUBDOMAIN.
      const targetEmails = [
        ...(email.envelope.to ?? []),
        ...(email.envelope.cc ?? []),
        ...(email.envelope.bcc ?? []),
      ].filter((email) => email.endsWith(`@${ASSISTANT_EMAIL_SUBDOMAIN}`));

      if (targetEmails.length === 0) {
        return apiError(req, res, {
          status_code: 401,
          api_error: {
            type: "invalid_request_error",
            message: "No target email found",
          },
        });
      }

      if (targetEmails.length > 1) {
        return apiError(req, res, {
          status_code: 401,
          api_error: {
            type: "invalid_request_error",
            message: "Multiple target emails found",
          },
        });
      }

      const matchRes = await emailAssistantMatcher({
        auth,
        targetEmail: targetEmails[0],
      });
      if (matchRes.isErr()) {
        void sendEmailAnswerOrError({
          user,
          htmlContent: `Error running assistant by email: could not find assistant. <br/><br/> Message: ${matchRes.error.type}`,
        });
        return apiError(req, res, {
          status_code: 401,
          api_error: {
            type: "invalid_request_error",
            message: `Failed to retrieve asssistant from email: ${matchRes.error.type}`,
          },
        });
      }

      const { agentConfiguration } = matchRes.value;

      const answerRes = await emailAnswer({
        auth,
        agentConfiguration: matchRes.value.agentConfiguration,
        threadTitle: email.subject,
        threadContent: email.text,
      });

      if (answerRes.isErr()) {
        void sendEmailAnswerOrError({
          user,
          agentConfiguration,
          htmlContent: `Error running ${agentConfiguration.name}: failed to retrieve answer. <br/><br/> Message: ${answerRes.error.type}`,
        });

        return apiError(req, res, {
          status_code: 401,
          api_error: {
            type: "invalid_request_error",
            message: `Failed to retrieve answer: ${answerRes.error.type}`,
          },
        });
      }

      // At this stage we can reply to the webhook.
      res.status(200).json({ success: true });

      const { conversation, htmlAnswer } = answerRes.value;

      void sendEmailAnswerOrError({
        user,
        agentConfiguration,
        htmlContent: `<a href="https://dust.tt/w/${
          auth.workspace()?.sId
        }/assistant/${
          conversation.sId
        }">Open this conversation in Dust</a><br /><br /> ${htmlAnswer}<br /><br /> ${
          agentConfiguration.name
        } at <a href="https://dust.tt">Dust.tt</a>`,
        threadTitle: email.subject,
        threadContent: email.text,
      });

      return;

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

export default withLogging(handler);
