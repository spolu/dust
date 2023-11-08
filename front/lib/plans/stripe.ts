import Stripe from "stripe";

import { countActiveSeatsInWorkspace } from "@app/lib/plans/workspace_usage";
import { assertNever } from "@app/lib/utils";
import { PaidBillingType, SubscriptionType } from "@app/types/plan";
import { WorkspaceType } from "@app/types/user";

import { Authenticator } from "../auth";

const { STRIPE_SECRET_KEY = "", URL = "" } = process.env;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  typescript: true,
});

/**
 * Calls the Stripe API to get the price ID for a given product ID.
 */
async function getPriceId(productId: string): Promise<string | null> {
  const prices = await stripe.prices.list({ product: productId });
  if (prices.data.length > 0) {
    const priceId = prices.data[0].id;
    return priceId;
  }
  return null;
}

/**
 * Calls the Stripe API to create a checkout session for a given workspace/plan.
 * We return the URL of the checkout session.
 * Once the users has completed the checkout, we will receive an event on our Stripe webhook
 */
export const createCheckoutSession = async ({
  auth,
  planCode,
  productId,
  billingType,
  stripeCustomerId,
}: {
  auth: Authenticator;
  planCode: string;
  productId: string;
  billingType: PaidBillingType;
  stripeCustomerId: string | null;
}): Promise<string | null> => {
  const workspace = auth.workspace();
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const priceId = await getPriceId(productId);
  if (!priceId) {
    throw new Error(
      `Cannot subscribe to plan ${planCode}:  price not found for product ${productId}.`
    );
  }

  let item: { price: string; quantity?: number } | null = null;

  switch (billingType) {
    case "fixed":
      // For a fixed price, quantity is 1 and will not change.
      item = {
        price: priceId,
        quantity: 1,
      };
      break;
    case "per_seat":
      // For a metered billing based on the number of seats, we create a line item with quantity = number of users in the workspace.
      // We will update the quantity of the line item when the number of users changes.
      item = {
        price: priceId,
        quantity: await countActiveSeatsInWorkspace(workspace.sId),
      };
      break;
    case "monthly_active_users":
      // For a metered billing based on the usage, we create a line item with no quantity.
      // We will notify Stripe of the usage when users are active in the workspace: when they post a message.
      item = {
        price: priceId,
      };
      break;
    default:
      assertNever(billingType);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: workspace.sId,
    customer: stripeCustomerId ? stripeCustomerId : undefined,
    metadata: {
      planCode: planCode,
    },
    line_items: [item],
    billing_address_collection: "auto",
    automatic_tax: {
      enabled: true,
    },
    success_url: `${URL}/w/${workspace.sId}/subscription?type=succeeded&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${URL}/w/${workspace.sId}/subscription?type=cancelled`,
  });

  return session.url;
};

/**
 * Calls the Stripe API to create a customer portal session for a given workspace/plan.
 * This allows the user to access her Stripe dashbaord without having to log in on Stripe.
 */
export const createCustomerPortalSession = async ({
  owner,
  subscription,
}: {
  owner: WorkspaceType;
  subscription: SubscriptionType;
}): Promise<string | null> => {
  if (!subscription.stripeCustomerId) {
    throw new Error("No customer ID found for the workspace");
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${URL}/w/${owner.sId}/subscription`,
  });

  return portalSession.url;
};

/**
 * Calls the Stripe API to retrieve a product by its ID.
 */
export const getProduct = async (
  productId: string
): Promise<Stripe.Product> => {
  const product = await stripe.products.retrieve(productId);
  return product;
};

/**
 * Calls the Stripe API to update the quantity of a subscription.
 * https://stripe.com/docs/billing/subscriptions/upgrade-downgrade
 */
export const updateStripeSubscriptionQuantity = async ({
  stripeSubscriptionId,
  stripeProductId,
  stripeCustomerId,
  quantity,
}: {
  stripeSubscriptionId: string;
  stripeProductId: string;
  stripeCustomerId: string;
  quantity: number;
}): Promise<void> => {
  // First, we get the current subscription
  const stripeSubscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
  });

  if (stripeSubscriptions.data.length !== 1) {
    throw new Error(
      "Cannot update subscription quantity: expected 1 subscription."
    );
  }

  const stripeSubscription = stripeSubscriptions.data[0];
  if (stripeSubscription.id !== stripeSubscriptionId) {
    throw new Error(
      "Cannot update subscription quantity: stripe subscription ID mismatch."
    );
  }

  const currentQuantity = stripeSubscriptions.data[0].items.data[0].quantity;
  if (currentQuantity === quantity) {
    // No need to update the subscription
    return;
  }

  const priceId = await getPriceId(stripeProductId);
  if (!priceId) {
    throw new Error(
      "Cannot update subscription quantity: stripe Price ID not found for this Product id."
    );
  }

  const subscriptionItemId = stripeSubscription.items.data[0].id;
  await stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: subscriptionItemId, quantity, price: priceId || undefined }],
  });
};
