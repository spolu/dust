import sgMail from "@sendgrid/mail";
import { NextApiRequest, NextApiResponse } from "next";
import { pipeline, Writable } from "stream";
import Stripe from "stripe";
import { promisify } from "util";

import { front_sequelize } from "@app/lib/databases";
import { ReturnedAPIErrorType } from "@app/lib/error";
import {
  Membership,
  Plan,
  Subscription,
  User,
  Workspace,
} from "@app/lib/models";
import { PlanInvitation } from "@app/lib/models/plan";
import { generateModelSId } from "@app/lib/utils";
import logger from "@app/logger/logger";
import { apiError, withLogging } from "@app/logger/withlogging";

const {
  SENDGRID_API_KEY = "",
  STRIPE_SECRET_KEY = "",
  STRIPE_SECRET_WEBHOOK_KEY = "",
} = process.env;

export type GetResponseBody = {
  success: true;
};

export const config = {
  api: {
    bodyParser: false, // Disable the default body parser
  },
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetResponseBody | ReturnedAPIErrorType>
): Promise<void> {
  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
    typescript: true,
  });

  switch (req.method) {
    case "GET":
      return res.status(200).json({ success: true });

    case "POST":
      const sig = req.headers["stripe-signature"] as string;
      let event: Stripe.Event | null = null;

      // Collect raw body using stream pipeline
      let rawBody = "";
      const collector = new Writable({
        write(chunk, encoding, callback) {
          rawBody += chunk.toString();
          callback();
        },
      });
      await promisify(pipeline)(req, collector);

      try {
        event = stripe.webhooks.constructEvent(
          rawBody,
          sig,
          STRIPE_SECRET_WEBHOOK_KEY
        );
      } catch (error) {
        logger.error({ error }, "Error constructing Stripe event in Webhook.");
      }

      if (!event) {
        return apiError(req, res, {
          status_code: 500,
          api_error: {
            type: "internal_server_error",
            message: "Error constructing Stripe Webhook event.",
          },
        });
      }
      const stripeSubscription = event.data.object as Stripe.Subscription;
      switch (event.type) {
        case "checkout.session.completed":
          // Payment is successful and the stripe subscription is created.
          // We can create the new subscription and end the active one if any.
          const session = event.data.object as Stripe.Checkout.Session;
          const workspaceId = session.client_reference_id;
          const stripeCustomerId = session.customer;
          const stripeSubscriptionId = session.subscription;
          const planCode = session?.metadata?.planCode || null;

          if (session.status === "open" || session.status === "expired") {
            // Open: The checkout session is still in progress. Payment processing has not started.
            // Expired: The checkout session has expired (e.g., because of lack of payment).
            logger.info(
              {
                workspaceId,
                stripeCustomerId,
                stripeSubscriptionId,
                planCode,
              },
              `[Stripe Webhook] Received checkout.session.completed with status "${session.status}". Ignoring event.`
            );
            return res.status(200).json({ success: true });
          }
          if (session.status !== "complete") {
            logger.error(
              {
                workspaceId,
                stripeCustomerId,
                stripeSubscriptionId,
                planCode,
              },
              `[Stripe Webhook] Received checkout.session.completed with unkown status "${session.status}". Ignoring event.`
            );
            return res.status(200).json({ success: true });
          }

          try {
            if (
              workspaceId === null ||
              stripeCustomerId === null ||
              planCode === null ||
              typeof stripeCustomerId !== "string" ||
              typeof stripeSubscriptionId !== "string"
            ) {
              throw new Error("Missing required data in event.");
            }

            const workspace = await Workspace.findOne({
              where: { sId: workspaceId },
            });
            if (!workspace) {
              throw new Error(`Cannot find workspace ${workspaceId}`);
            }
            const plan = await Plan.findOne({
              where: { code: planCode },
            });
            if (!plan) {
              throw new Error(
                `Cannot subscribe to plan ${planCode}:  not found.`
              );
            }

            await front_sequelize.transaction(async (t) => {
              const now = new Date();
              const activeSubscription = await Subscription.findOne({
                where: { workspaceId: workspace.id, status: "active" },
                transaction: t,
              });

              if (
                activeSubscription &&
                activeSubscription.stripeSubscriptionId === stripeSubscriptionId
              ) {
                // We already have a subscription for this workspace and this stripe subscription.
                logger.info(
                  {
                    workspaceId,
                    stripeCustomerId,
                    stripeSubscriptionId,
                    planCode,
                  },
                  "[Stripe Webhook] Received checkout.session.completed when we already have a subscription for this workspace and this stripe subscription. Ignoring event"
                );
                return res.status(200).json({ success: true });
              }

              // mark existing plan invite as consumed
              const planInvitations = await PlanInvitation.findAll({
                where: {
                  workspaceId: workspace.id,
                  consumedAt: null,
                },
                transaction: t,
              });

              if (planInvitations.length > 1) {
                logger.error(
                  {
                    workspaceId,
                    stripeCustomerId,
                    stripeSubscriptionId,
                    planCode,
                  },
                  `[Stripe Webhook] Received checkout.session.completed when we have more than one plan invitation for this workspace.`
                );
              }

              if (
                planInvitations.length === 1 &&
                planInvitations[0].planId !== plan.id
              ) {
                logger.error(
                  {
                    workspaceId,
                    stripeCustomerId,
                    stripeSubscriptionId,
                    planCode,
                  },
                  `[Stripe Webhook] Received checkout.session.completed when we have a plan invitation for this workspace but not for this plan.`
                );
              }

              await PlanInvitation.update(
                {
                  consumedAt: now,
                },
                {
                  where: {
                    workspaceId: workspace.id,
                    consumedAt: null,
                  },
                  transaction: t,
                }
              );

              if (activeSubscription) {
                await activeSubscription.update(
                  {
                    status: "ended",
                    endDate: now,
                  },
                  { transaction: t }
                );
              }
              await Subscription.create(
                {
                  sId: generateModelSId(),
                  workspaceId: workspace.id,
                  planId: plan.id,
                  status: "active",
                  startDate: now,
                  stripeSubscriptionId: stripeSubscriptionId,
                  stripeCustomerId: stripeCustomerId,
                },
                { transaction: t }
              );
            });

            return res.status(200).json({ success: true });
          } catch (error) {
            logger.error(
              {
                error,
                workspaceId,
                stripeCustomerId,
                stripeSubscriptionId,
                planCode,
              },
              "Error creating subscription."
            );

            return apiError(req, res, {
              status_code: 500,
              api_error: {
                type: "internal_server_error",
                message:
                  "Stripe Webhook: error handling checkout.session.completed.",
              },
            });
          }
        case "invoice.paid":
          // This is what confirms the subscription is active and payments are being made.
          // Should we store the last invoice date in the subscription?
          logger.info(
            { event },
            "[Stripe Webhook] Received customer.invoice.paid event."
          );
          break;
        case "invoice.payment_failed":
          // Occurs when payment failed or the user does not have a valid payment method.
          // The stripe subscription becomes "past_due".
          // We keep active and email the user and us to manually manage those cases first?
          logger.warn(
            { event },
            "[Stripe Webhook] Received invoice.payment_failed event."
          );
          break;
        case "customer.subscription.updated":
          // Occurs when the subscription is updated:
          // - when the number of seats changes for a metered billing.
          // - when the subscription is canceled by the user: it is ended at the of the billing period, and we will receive a "customer.subscription.deleted" event.
          // - when the subscription is activated again after being canceled but before the end of the billing period.
          logger.info(
            { event },
            "[Stripe Webhook] Received customer.subscription.updated event."
          );
          const previousAttributes = event.data.previous_attributes;
          if (!previousAttributes) break; // should not happen by definition of the subscription.updated event

          if (
            // The subscription is canceled (but not yet ended) or reactivated
            stripeSubscription.status === "active" &&
            "cancel_at_period_end" in previousAttributes
          ) {
            // first update subscription endDate in our database
            const result = await Subscription.update(
              {
                endDate: stripeSubscription.cancel_at
                  ? new Date(stripeSubscription.cancel_at * 1000)
                  : null,
              },
              { where: { stripeSubscriptionId: stripeSubscription.id } }
            );
            if (result[0] !== 1) {
              return apiError(req, res, {
                status_code: 500,
                api_error: {
                  type: "internal_server_error",
                  message:
                    "Stripe Webhook: canceling subscription: Error updating subscription in database.",
                },
              });
            }
            // then email admins
            const adminEmails = await getAdminEmailsForSubscription(
              stripeSubscription.id
            );
            if (adminEmails.length === 0) {
              return apiError(req, res, {
                status_code: 500,
                api_error: {
                  type: "internal_server_error",
                  message:
                    "Stripe Webhook: canceling subscription: Error getting admin emails.",
                },
              });
            }
            // send email to admins
            for (const adminEmail of adminEmails)
              await sendAdminEmail(
                adminEmail,
                stripeSubscription.cancel_at_period_end
                  ? cancellationMessage
                  : reactivationMessage
              );
          }
          break;
        case "customer.subscription.deleted":
          // Occurs when the subscription is canceled by the user or by us.
          if (stripeSubscription.status === "canceled") {
            // We can end the subscription in our database.
            const activeSubscription = await Subscription.findOne({
              where: { stripeSubscriptionId: stripeSubscription.id },
            });
            if (!activeSubscription) {
              return apiError(req, res, {
                status_code: 500,
                api_error: {
                  type: "internal_server_error",
                  message:
                    "Stripe Webhook: Error handling customer.subscription.deleted. Subscription not found.",
                },
              });
            }
            await activeSubscription.update({
              status: "ended",
              endDate: new Date(),
            });
          } else {
            logger.warn(
              { event },
              "[Stripe Webhook] Received customer.subscription.deleted event but the subscription is not canceled."
            );
          }
          break;
        default:
        // Unhandled event type
      }

      return res.status(200).json({ success: true });

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

async function getAdminEmailsForSubscription(stripeSubscriptionId: string) {
  const users = await User.findAll({
    attributes: ["email"],
    include: [
      {
        model: Membership,
        required: true,
        where: {
          role: "admin",
        },
        attributes: [],
        include: [
          {
            model: Workspace,
            required: true,
            attributes: [],
            include: [
              {
                model: Subscription,
                required: true,
                where: {
                  stripeSubscriptionId,
                },
                attributes: [],
              },
            ],
          },
        ],
      },
    ],
  });
  return users.map((u) => u.email);
}

sgMail.setApiKey(SENDGRID_API_KEY);

const cancellationMessage = {
  from: {
    name: "Dust team",
    email: "team@dust.tt",
  },
  subject: `[Dust] Your subscription has been canceled; important information`,
  text: `<p>You have requested to cancel your subscription</p> 
  <p>Your subscription will end at the end of the current billing period. You can reactivate your subscription at any time before then. If you do not reactivate your subscription, you will be switched back to our free plan at the end of the current billing period.</p>
  <p>This will have the following consequences:</p>
  <ul>
  <li>all users except one will be removed from your workspace;</li>
  <li>your connections will be deleted</li>
  <li>the rest of your data (conversations, custom assistants, custom datasource) will still be accessible but with multiple limitations.</li>
  <li>you will be subjected to the <a>restrictions of the free plan</a></li>
  </ul>
  <p>Complete details as to what will happen are available at <a href="https://dust.tt/pricing">subscription cancelling FAQ</a>.</p>
  <p>If you have any questions, please contact us at team@dust.tt.</p>
  <p>Best,</p>
  <p>The Dust team</p>`,
};

const reactivationMessage = {
  from: {
    name: "Dust team",
    email: "team@dust.tt",
  },
  subject: `[Dust] Your subscription has been reactivated`,
  text: `<p>You have requested to reactivate your subscription.</p> 
  <p>Therefore, your subscription will not be canceled at the end of the billing period, no downgrade actions will take place, and you can continue using Dust as usual.</p>
  <p>We really appreciate you renewing your trust in us.</p>
  <p>If you have any questions, we'll gladly answer at team@dust.tt.</p>
  <p>Best,</p>
  <p>The Dust team</p>`,
};

async function sendAdminEmail(email: string, message: any) {
  const msg = { ...message, to: email };
  try {
    await sgMail.send(msg);
    logger.info(
      { email, subject: message.subject },
      "Sending email to admin about subscription."
    );
  } catch (error) {
    logger.error(
      { error, email },
      "Error sending email to admin about subscription cancellation."
    );
  }
}
export default withLogging(handler);
