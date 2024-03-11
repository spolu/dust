import type { Attributes } from "sequelize";

import { Plan } from "@app/lib/models";
import {
  FREE_TEST_PLAN_CODE,
  FREE_UPGRADED_PLAN_CODE,
} from "@app/lib/plans/plan_codes";

export type PlanAttributes = Omit<
  Attributes<Plan>,
  "id" | "createdAt" | "updatedAt"
>;

/**
 * We have 3 categories of plans:
 * - Free: plans with no paid subscription.
 * - Pro: plans with a paid subscription, not tailored. -> i.e. the same plan is used by all Pro workspaces.
 * - Entreprise: plans with a paid subscription, tailored to the needs of the entreprise. -> i.e. we will have one plan per "Entreprise".
 *
 * This file about Free plans.
 */

/**
 * FREE_TEST plan is our default plan: this is the plan used by all workspaces until they subscribe to a plan.
 * It is not stored in the database (as we don't create a subsription).
 */
export const FREE_TEST_PLAN_DATA: PlanAttributes = {
  code: FREE_TEST_PLAN_CODE,
  name: "Free",
  stripeProductId: null,
  billingType: "free",
  maxMessages: 50,
  maxUsersInWorkspace: 1,
  isSlackbotAllowed: false,
  isManagedConfluenceAllowed: false,
  isManagedSlackAllowed: false,
  isManagedNotionAllowed: false,
  isManagedGoogleDriveAllowed: false,
  isManagedGithubAllowed: false,
  isManagedIntercomAllowed: false,
  isManagedWebCrawlerAllowed: false,
  maxDataSourcesCount: 5,
  maxDataSourcesDocumentsCount: 10,
  maxDataSourcesDocumentsSizeMb: 2,
  trialPeriodDays: 0,
};

/**
 * Other FREE plans are stored in the database.
 * We can update existing plans or add new one but never remove anything from this list.
 */
const FREE_PLANS_DATA: PlanAttributes[] = [
  {
    code: FREE_UPGRADED_PLAN_CODE,
    name: "Free Trial",
    stripeProductId: null,
    billingType: "free",
    maxMessages: -1,
    maxUsersInWorkspace: -1,
    isSlackbotAllowed: true,
    isManagedConfluenceAllowed: true,
    isManagedSlackAllowed: true,
    isManagedNotionAllowed: true,
    isManagedGoogleDriveAllowed: true,
    isManagedGithubAllowed: true,
    isManagedIntercomAllowed: true,
    isManagedWebCrawlerAllowed: true,
    maxDataSourcesCount: -1,
    maxDataSourcesDocumentsCount: -1,
    maxDataSourcesDocumentsSizeMb: 2,
    trialPeriodDays: 0,
  },
];

/**
 * Function to call when we edit something in FREE_PLANS_DATA to update the database. It will create or update the plans.
 */
export const upsertFreePlans = async () => {
  for (const planData of FREE_PLANS_DATA) {
    const plan = await Plan.findOne({
      where: {
        code: planData.code,
      },
    });
    if (plan === null) {
      await Plan.create(planData);
      console.log(`Free plan ${planData.code} created.`);
    } else {
      await plan.update(planData);
      console.log(`Free plan ${planData.code} updated.`);
    }
  }
};
