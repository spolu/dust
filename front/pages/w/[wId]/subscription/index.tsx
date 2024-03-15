import {
  ArrowPathIcon,
  Button,
  Chip,
  ExternalLinkIcon,
  Page,
  ShapesIcon,
  Spinner,
} from "@dust-tt/sparkle";
import type { UserType, WorkspaceType } from "@dust-tt/types";
import type { PlanInvitationType, SubscriptionType } from "@dust-tt/types";
import type { InferGetServerSidePropsType } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useContext, useEffect, useState } from "react";

import { PricePlans } from "@app/components/PlansTables";
import AppLayout from "@app/components/sparkle/AppLayout";
import { subNavigationAdmin } from "@app/components/sparkle/navigation";
import { SendNotificationsContext } from "@app/components/sparkle/Notification";
import { SubscriptionContactUsDrawer } from "@app/components/SubscriptionContactUsDrawer";
import { useSubmitFunction } from "@app/lib/client/utils";
import { withDefaultUserAuthRequirements } from "@app/lib/iam/session";
import {
  FREE_TEST_PLAN_CODE,
  FREE_UPGRADED_PLAN_CODE,
  isUpgraded,
  PRO_PLAN_SEAT_29_CODE,
} from "@app/lib/plans/plan_codes";
import { getStripeSubscription } from "@app/lib/plans/stripe";
import { getPlanInvitation } from "@app/lib/plans/subscription";

const { GA_TRACKING_ID = "" } = process.env;

export const getServerSideProps = withDefaultUserAuthRequirements<{
  owner: WorkspaceType;
  subscription: SubscriptionType;
  user: UserType;
  planInvitation: PlanInvitationType | null;
  trialDaysRemaining: number | null;
  gaTrackingId: string;
}>(async (context, auth) => {
  const owner = auth.workspace();
  const subscription = auth.subscription();
  const user = auth.user();
  if (!owner || !auth.isAdmin() || !subscription || !user) {
    return {
      notFound: true,
    };
  }

  const planInvitation = await getPlanInvitation(auth);

  let trialDaysRemaining = null;
  if (subscription.trialing && subscription.stripeSubscriptionId) {
    const stripeSubscription = await getStripeSubscription(
      subscription.stripeSubscriptionId
    );
    trialDaysRemaining = stripeSubscription.trial_end
      ? Math.ceil(
          (stripeSubscription.trial_end * 1000 - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      : null;
  }

  return {
    props: {
      owner,
      subscription,
      trialDaysRemaining,
      planInvitation: planInvitation,
      gaTrackingId: GA_TRACKING_ID,
      user,
    },
  };
});

export default function Subscription({
  owner,
  user,
  subscription,
  planInvitation,
  trialDaysRemaining,
  gaTrackingId,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const sendNotification = useContext(SendNotificationsContext);
  const [isWebhookProcessing, setIsWebhookProcessing] =
    React.useState<boolean>(false);

  const [showContactUsDrawer, setShowContactUsDrawer] = useState(false);

  useEffect(() => {
    if (router.query.type === "succeeded") {
      if (subscription.plan.code === router.query.plan_code) {
        sendNotification({
          type: "success",
          title: `Subscription to ${subscription.plan.name}`,
          description: `Your subscription to ${subscription.plan.name} is now active. Thank you for your trust.`,
        });
        // Then we remove the query params to avoid going through this logic again.
        void router.push(
          { pathname: `/w/${owner.sId}/subscription` },
          undefined,
          {
            shallow: true,
          }
        );
      } else {
        // If the Stripe webhook is not yet received, we try waiting for it and reload the page every 5 seconds until it's done.
        setIsWebhookProcessing(true);
        setTimeout(() => {
          void router.reload();
        }, 5000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally passing an empty dependency array to execute only once

  const { submit: handleSubscribePlan, isSubmitting: isSubscribingPlan } =
    useSubmitFunction(async () => {
      const res = await fetch(`/api/w/${owner.sId}/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        sendNotification({
          type: "error",
          title: "Subscription failed",
          description: "Failed to subscribe to a new plan.",
        });
        // Then we remove the query params to avoid going through this logic again.
        void router.push(
          { pathname: `/w/${owner.sId}/subscription` },
          undefined,
          {
            shallow: true,
          }
        );
      } else {
        const content = await res.json();
        if (content.checkoutUrl) {
          await router.push(content.checkoutUrl);
        } else if (content.success) {
          router.reload(); // We cannot swr the plan so we just reload the page.
        }
      }
    });

  const {
    submit: handleGoToStripePortal,
    isSubmitting: isGoingToStripePortal,
  } = useSubmitFunction(async () => {
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: owner.sId,
      }),
    });
    if (!res.ok) {
      sendNotification({
        type: "error",
        title: "Failed to open billing dashboard",
        description: "Failed to open billing dashboard.",
      });
    } else {
      const content = await res.json();
      if (content.portalUrl) {
        window.open(content.portalUrl, "_blank");
      }
    }
  });

  const isProcessing = isSubscribingPlan || isGoingToStripePortal;

  const plan = subscription.plan;
  const chipColor = !isUpgraded(plan) ? "emerald" : "sky";

  const onClickProPlan = async () => handleSubscribePlan();
  const onClickEnterprisePlan = () => {
    setShowContactUsDrawer(true);
  };
  const onSubscribeEnterprisePlan = async () => {
    if (!planInvitation) {
      throw new Error("Unreachable: No plan invitation");
    }
    await handleSubscribePlan();
  };

  const planLabel =
    trialDaysRemaining === null
      ? plan.name
      : `${plan.name} (${trialDaysRemaining} days free trial remaining)`;

  return (
    <AppLayout
      subscription={subscription}
      owner={owner}
      gaTrackingId={gaTrackingId}
      topNavigationCurrent="admin"
      subNavigation={subNavigationAdmin({ owner, current: "subscription" })}
    >
      <SubscriptionContactUsDrawer
        show={showContactUsDrawer}
        onClose={() => {
          setShowContactUsDrawer(false);
        }}
        initialEmail={user.email}
      />
      <Page.Vertical gap="xl" align="stretch">
        <Page.Header
          title="Subscription"
          icon={ShapesIcon}
          description="Manage and discover Dust plans."
        />
        {!planInvitation ? (
          <Page.Vertical align="stretch" gap="md">
            <div className="flex">
              <div className="flex-1">
                <Page.H variant="h5">Your plan </Page.H>
                <div className="pt-2">
                  {isWebhookProcessing ? (
                    <Spinner />
                  ) : (
                    <>
                      You're on&nbsp;&nbsp;
                      <Chip size="sm" color={chipColor} label={planLabel} />
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1">
                {subscription.stripeCustomerId && (
                  <>
                    <Page.H variant="h5">Payment, invoicing & billing</Page.H>
                    <div className="pt-2">
                      <Button
                        icon={
                          subscription.paymentFailingSince
                            ? ArrowPathIcon
                            : ExternalLinkIcon
                        }
                        size="sm"
                        variant={
                          subscription.paymentFailingSince
                            ? "secondaryWarning"
                            : "secondary"
                        }
                        label={
                          subscription.paymentFailingSince
                            ? "Update your payment method"
                            : "Visit Dust's dashboard on Stripe"
                        }
                        disabled={isProcessing}
                        onClick={async () => handleGoToStripePortal()}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            {!plan ||
              ([
                FREE_TEST_PLAN_CODE,
                PRO_PLAN_SEAT_29_CODE,
                FREE_UPGRADED_PLAN_CODE,
              ].includes(plan.code) && (
                <div className="pt-2">
                  <Page.H variant="h5">Manage my plan</Page.H>
                  <div className="s-h-full s-w-full pt-2">
                    <PricePlans
                      display="landing"
                      size="xs"
                      className="lg:hidden"
                      isTabs
                      plan={plan}
                      onClickProPlan={onClickProPlan}
                      onClickEnterprisePlan={onClickEnterprisePlan}
                      isProcessing={isProcessing}
                    />
                    <PricePlans
                      display="landing"
                      size="xs"
                      flexCSS="gap-3"
                      className="hidden lg:flex"
                      plan={plan}
                      onClickProPlan={onClickProPlan}
                      onClickEnterprisePlan={onClickEnterprisePlan}
                      isProcessing={isProcessing}
                    />
                  </div>
                </div>
              ))}
            <Link href="/terms" target="_blank" className="text-sm">
              Terms of use apply to all plans.
            </Link>
          </Page.Vertical>
        ) : (
          <Page.Vertical>
            <div>
              You have been invited to the <b>{planInvitation.planName}</b>{" "}
              enterprise plan.
            </div>
            <Button label="Subscribe" onClick={onSubscribeEnterprisePlan} />
          </Page.Vertical>
        )}
      </Page.Vertical>
      <div className="h-12" />
    </AppLayout>
  );
}
