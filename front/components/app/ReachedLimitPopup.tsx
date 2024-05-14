import { Dialog, Page } from "@dust-tt/sparkle";
import type { SubscriptionType, WorkspaceType } from "@dust-tt/types";
import { assertNever } from "@dust-tt/types";
import type { NextRouter } from "next/router";
import { useRouter } from "next/router";
import { useEffect } from "react";

import { isTrial } from "@app/lib/plans/trial";
import { ClientSideTracking } from "@app/lib/tracking/client";

export type WorkspaceLimit =
  | "cant_invite_no_seats_available"
  | "cant_invite_free_plan"
  | "cant_invite_payment_failure"
  | "message_limit";

function getLimitPromptForCode(
  router: NextRouter,
  owner: WorkspaceType,
  code: WorkspaceLimit,
  subscription: SubscriptionType
) {
  switch (code) {
    case "cant_invite_no_seats_available": {
      if (subscription.trialing) {
        return {
          title: "Fair usage limit reached",
          validateLabel: "Manage your subscription",
          onValidate: () => {
            void router.push(`/w/${owner.sId}/subscription`);
          },
          children: (
            <Page.Vertical gap="lg">
              <Page.P>
                You can invite up to {subscription.plan.limits.users.maxUsers}{" "}
                members in during trial.
              </Page.P>
              <p className="text-sm font-bold text-element-800">
                You can end your trial and start paying now to invite more
                members.
              </p>
            </Page.Vertical>
          ),
        };
      } else {
        return {
          title: "Plan Limits",
          validateLabel: "Manage your subscription",
          onValidate: () => {
            void router.push(`/w/${owner.sId}/subscription`);
          },
          children: (
            <>
              <Page.P>
                Workspace has reached its member limit. Please upgrade or remove
                inactive members to add more.
              </Page.P>
            </>
          ),
        };
      }
    }
    case "cant_invite_free_plan":
      return {
        title: "Free plan",
        validateLabel: "Manage your subscription",
        onValidate: () => {
          void router.push(`/w/${owner.sId}/subscription`);
        },
        children: (
          <>
            <Page.P>
              You cannot invite other members with the free plan. Upgrade your
              plan for unlimited members.
            </Page.P>
          </>
        ),
      };
    case "cant_invite_payment_failure":
      return {
        title: "Failed payment",
        validateLabel: "Manage your subscription",
        onValidate: () => {
          void router.push(`/w/${owner.sId}/subscription`);
        },
        children: (
          <>
            <Page.P>
              You cannot invite other members while your workspace has a failed
              payment.
            </Page.P>
          </>
        ),
      };

    case "message_limit": {
      if (subscription.trialing) {
        return {
          title: "Fair usage limit reached",
          validateLabel: "Manage your subscription",
          onValidate: () => {
            void router.push(`/w/${owner.sId}/subscription`);
          },
          children: (
            <>
              <Page.P>
                We limit usage of Dust during the trial. You've reached your
                limit for today.
              </Page.P>
              <p className="text-sm font-normal text-element-800">
                Come back tomorrow for a fresh start or{" "}
                <span className="font-bold">
                  end your trial and start paying now.
                </span>
              </p>
            </>
          ),
        };
      } else {
        return {
          title: "Message quota exceeded",
          validateLabel: "Ok",
          children: (
            <p className="text-sm font-normal text-element-800">
              As part of our fair usage policy, we've put a brief pause on your
              messaging since you've reached the 100 message limit within a 24h
              window. Check our Fair Use policy to learn more.
            </p>
          ),
        };
      }
    }

    default:
      assertNever(code);
  }
}

export function ReachedLimitPopup({
  isOpened,
  onClose,
  subscription,
  owner,
  code,
}: {
  isOpened: boolean;
  onClose: () => void;
  subscription: SubscriptionType;
  owner: WorkspaceType;
  code: WorkspaceLimit;
}) {
  const router = useRouter();
  const trialing = isTrial(subscription);
  const { title, children, validateLabel, onValidate } = getLimitPromptForCode(
    router,
    owner,
    code,
    subscription
  );

  useEffect(() => {
    if (isOpened) {
      void ClientSideTracking.trackFairUsageDialogViewed({
        workspaceId: owner.sId,
        workspaceName: owner.name,
        trialing,
      });
    }
  }, [isOpened, owner.name, owner.sId, trialing]);

  return (
    <Dialog
      title={title}
      isOpen={isOpened}
      onValidate={
        onValidate ||
        (() => {
          onClose();
        })
      }
      onCancel={() => onClose()}
      cancelLabel="Close"
      validateLabel={validateLabel}
    >
      {children}
    </Dialog>
  );
}
