import { Button, RocketIcon } from "@dust-tt/sparkle";
import React from "react";

import { Grid, H2 } from "@app/components/home/contentComponents";
import { PricePlans } from "@app/components/PlansTables";
import { classNames } from "@app/lib/utils";

export function PricingPage() {
  return (
    <>
      <div
        className={classNames(
          "container flex flex-col",
          "gap-16 py-24",
          "md:gap-28 md:py-36",
          "xl:gap-36",
          "2xl:gap-48"
        )}
      >
        <Grid>
          <div
            // ref={scrollRef4}
            className="col-span-12 text-center md:pb-6 xl:pb-10"
          >
            <H2 className="pb-4 text-slate-50 md:pb-6 xl:pb-10">
              Start with Dust!
              <br />
              <span className="text-slate-200/50">Meet our pricing plans.</span>
            </H2>
            <div>
              <Button
                variant="primary"
                size="md"
                label="Start with Dust Now"
                icon={RocketIcon}
                onClick={() =>
                  (window.location.href = `/api/auth/login?returnTo=${getReturnToUrl(
                    router.query
                  )}`)
                }
              />
            </div>
          </div>
          <div className="s-dark col-span-12 flex flex-row justify-center lg:px-2 2xl:px-24">
            <PricePlans
              display="landing"
              size="xs"
              className="lg:hidden"
              isTabs
              onClickProPlan={() =>
                (window.location.href = `/api/auth/login?returnTo=${getReturnToUrl(
                  router.query
                )}`)
              }
              onClickEnterprisePlan={() => setShowContactUsDrawer(true)}
            />
            <PricePlans
              display="landing"
              size="xs"
              className="hidden lg:flex xl:hidden"
              onClickProPlan={() =>
                (window.location.href = `/api/auth/login?returnTo=${getReturnToUrl(
                  router.query
                )}`)
              }
              onClickEnterprisePlan={() => setShowContactUsDrawer(true)}
            />
            <PricePlans
              display="landing"
              size="sm"
              className="hidden xl:flex"
              onClickProPlan={() =>
                (window.location.href = `/api/auth/login?returnTo=${getReturnToUrl(
                  router.query
                )}`)
              }
              onClickEnterprisePlan={() => setShowContactUsDrawer(true)}
            />
          </div>
        </Grid>
      </div>
    </>
  );
}
