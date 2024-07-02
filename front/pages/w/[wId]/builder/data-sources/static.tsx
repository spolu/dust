import {
  ContextItem,
  DocumentPileIcon,
  FolderOpenIcon,
  IconButton,
  MoreIcon,
  Page,
  PlusIcon,
  Popup,
  RobotIcon,
} from "@dust-tt/sparkle";
import type { DataSourceType, WorkspaceType } from "@dust-tt/types";
import type { PlanType, SubscriptionType } from "@dust-tt/types";
import _ from "lodash";
import type { InferGetServerSidePropsType } from "next";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

import { EmptyCallToAction } from "@app/components/EmptyCallToAction";
import { subNavigationBuild } from "@app/components/navigation/config";
import AppLayout from "@app/components/sparkle/AppLayout";
import type { AgentEnabledDataSource } from "@app/lib/api/agent_data_sources";
import { getAgentEnabledDataSources } from "@app/lib/api/agent_data_sources";
import { getDataSources } from "@app/lib/api/data_sources";
import { useSubmitFunction } from "@app/lib/client/utils";
import { withDefaultUserAuthRequirements } from "@app/lib/iam/session";

const { GA_TRACKING_ID = "" } = process.env;

export const getServerSideProps = withDefaultUserAuthRequirements<{
  owner: WorkspaceType;
  subscription: SubscriptionType;
  plan: PlanType;
  readOnly: boolean;
  dataSources: DataSourceType[];
  gaTrackingId: string;
  agentEnabledDataSources: AgentEnabledDataSource[];
}>(async (context, auth) => {
  const owner = auth.workspace();
  const plan = auth.plan();
  const subscription = auth.subscription();

  if (!owner || !plan || !subscription) {
    return {
      notFound: true,
    };
  }

  const readOnly = !auth.isBuilder();

  const agentEnabledDataSources = await getAgentEnabledDataSources({
    auth,
    providerFilter: null,
  });
  const allDataSources = await getDataSources(auth, { includeEditedBy: true });
  const dataSources = allDataSources.filter((ds) => !ds.connectorId);
  return {
    props: {
      owner,
      subscription,
      plan,
      readOnly,
      dataSources,
      gaTrackingId: GA_TRACKING_ID,
      agentEnabledDataSources,
    },
  };
});

export default function DataSourcesView({
  owner,
  subscription,
  plan,
  readOnly,
  dataSources,
  gaTrackingId,
  agentEnabledDataSources,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const [showDatasourceLimitPopup, setShowDatasourceLimitPopup] =
    useState(false);
  const {
    submit: handleCreateDataSource,
    isSubmitting: isSubmittingCreateDataSource,
  } = useSubmitFunction(async () => {
    // Enforce plan limits: DataSources count.
    if (
      plan.limits.dataSources.count != -1 &&
      dataSources.length >= plan.limits.dataSources.count
    ) {
      setShowDatasourceLimitPopup(true);
    } else {
      void router.push(`/w/${owner.sId}/builder/data-sources/new`);
    }
  });
  const agentCountPerDataSource = useMemo(() => {
    return _.countBy(agentEnabledDataSources, "dataSourceId");
  }, [agentEnabledDataSources]);

  return (
    <AppLayout
      subscription={subscription}
      owner={owner}
      gaTrackingId={gaTrackingId}
      subNavigation={subNavigationBuild({
        owner,
        current: "data_sources_static",
      })}
    >
      <Page.Vertical gap="xl" align="stretch">
        <Page.Header
          title="Folders"
          icon={DocumentPileIcon}
          description="Make more documents accessible to this workspace. Manage folders manually or via API."
        />

        {dataSources.length > 0 ? (
          <div className="relative">
            <Page.SectionHeader
              title=""
              description=""
              action={
                !readOnly
                  ? {
                      label: "Add a new Folder",
                      variant: "primary",
                      icon: PlusIcon,
                      onClick: async () => {
                        await handleCreateDataSource();
                      },
                      disabled: isSubmittingCreateDataSource,
                    }
                  : undefined
              }
            />
            <Popup
              show={showDatasourceLimitPopup}
              chipLabel={`${plan.name} plan`}
              description={`You have reached the limit of data sources (${plan.limits.dataSources.count} data sources). Upgrade your plan for unlimited datasources.`}
              buttonLabel="Check Dust plans"
              buttonClick={() => {
                void router.push(`/w/${owner.sId}/subscription`);
              }}
              onClose={() => {
                setShowDatasourceLimitPopup(false);
              }}
              className="absolute bottom-8 right-0"
            />
          </div>
        ) : (
          <EmptyCallToAction
            label="Create a new Folder"
            icon={PlusIcon}
            onClick={async () => {
              await handleCreateDataSource();
            }}
          />
        )}
        <ContextItem.List>
          {dataSources.map((ds) => (
            <ContextItem
              key={ds.name}
              title={ds.name}
              visual={
                <ContextItem.Visual
                  visual={({ className }) =>
                    FolderOpenIcon({
                      className: className + " text-element-600",
                    })
                  }
                />
              }
              subElement={
                <div className="flex items-center gap-1 text-xs text-element-700">
                  <span>Added by: {ds.editedByUser?.fullName} | </span>
                  <span className="underline">
                    {agentCountPerDataSource[ds.id] ?? 0}
                  </span>
                  <RobotIcon />
                </div>
              }
              action={
                <IconButton
                  icon={MoreIcon}
                  onClick={() => {
                    void router.push(
                      `/w/${owner.sId}/builder/data-sources/${ds.name}`
                    );
                  }}
                />
              }
            >
              <ContextItem.Description>
                <div className="text-sm text-element-700">{ds.description}</div>
              </ContextItem.Description>
            </ContextItem>
          ))}
        </ContextItem.List>
      </Page.Vertical>
    </AppLayout>
  );
}
