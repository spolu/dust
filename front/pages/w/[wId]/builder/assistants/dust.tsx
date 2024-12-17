import {
  Avatar,
  CloudArrowDownIcon,
  ContextItem,
  LogoSquareColorLogo,
  Page,
  PlusIcon,
  SliderToggle,
} from "@dust-tt/sparkle";
import { useSendNotification } from "@dust-tt/sparkle";
import type {
  APIError,
  DataSourceType,
  LightAgentConfigurationType,
  SpaceType,
  SubscriptionType,
  WorkspaceType,
} from "@dust-tt/types";
import type { InferGetServerSidePropsType } from "next";
import { useRouter } from "next/router";

import AppLayout from "@app/components/sparkle/AppLayout";
import { AppLayoutSimpleCloseTitle } from "@app/components/sparkle/AppLayoutTitle";
import { getConnectorProviderLogoWithFallback } from "@app/lib/connector_providers";
import { getDisplayNameForDataSource } from "@app/lib/data_sources";
import { withDefaultUserAuthRequirements } from "@app/lib/iam/session";
import { SpaceResource } from "@app/lib/resources/space_resource";
import { useAgentConfigurations } from "@app/lib/swr/assistants";
import { useDataSources } from "@app/lib/swr/data_sources";
import { useSpaceDataSourceViews } from "@app/lib/swr/spaces";

export const getServerSideProps = withDefaultUserAuthRequirements<{
  owner: WorkspaceType;
  subscription: SubscriptionType;
  globalSpace: SpaceType;
}>(async (context, auth) => {
  const owner = auth.workspace();
  const subscription = auth.subscription();

  if (!owner || !auth.isBuilder() || !subscription) {
    return {
      notFound: true,
    };
  }

  const globalSpace = await SpaceResource.fetchWorkspaceGlobalSpace(auth);

  return {
    props: {
      owner,
      subscription,
      globalSpace: globalSpace.toJSON(),
    },
  };
});

export default function EditDustAssistant({
  owner,
  subscription,
  globalSpace,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const sendNotification = useSendNotification();

  const {
    agentConfigurations,
    mutateRegardlessOfQueryParams: mutateAgentConfigurations,
  } = useAgentConfigurations({
    workspaceId: owner.sId,
    agentsGetView: "global",
  });

  const { spaceDataSourceViews, mutate: mutateDataSourceViews } =
    useSpaceDataSourceViews({
      workspaceId: owner.sId,
      spaceId: globalSpace.sId,
    });

  const sortedDatasources = spaceDataSourceViews.sort((a, b) => {
    if (a.dataSource.connectorProvider && !b.dataSource.connectorProvider) {
      return -1;
    }
    if (!a.dataSource.connectorProvider && b.dataSource.connectorProvider) {
      return 1;
    }
    if (
      a.dataSource.connectorProvider === "webcrawler" &&
      b.dataSource.connectorProvider !== "webcrawler"
    ) {
      return 1;
    }
    if (
      a.dataSource.connectorProvider !== "webcrawler" &&
      b.dataSource.connectorProvider === "webcrawler"
    ) {
      return -1;
    }
    return a.dataSource.name.localeCompare(b.dataSource.name);
  });

  const dustAgentConfiguration = agentConfigurations?.find(
    (c) => c.name === "dust"
  );
  if (!dustAgentConfiguration) {
    return null;
  }

  const handleToggleAgentStatus = async (
    agent: LightAgentConfigurationType
  ) => {
    if (agent.status === "disabled_missing_datasource") {
      sendNotification({
        title: "Dust Assistant",
        description:
          "The Dust assistant requres at least one data source to be enabled.",
        type: "error",
      });
      return;
    }
    const res = await fetch(
      `/api/w/${owner.sId}/assistant/global_agents/${agent.sId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status:
            agent.status === "disabled_by_admin"
              ? "active"
              : "disabled_by_admin",
        }),
      }
    );

    if (!res.ok) {
      const data = await res.json();
      window.alert(`Error toggling Assistant: ${data.error.message}`);
      return;
    }

    await mutateAgentConfigurations();
  };

  const updateDatasourceSettings = async (
    settings: {
      assistantDefaultSelected: boolean;
    },
    dataSource: DataSourceType
  ) => {
    const res = await fetch(
      `/api/w/${owner.sId}/data_sources/${dataSource.sId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      }
    );
    if (!res.ok) {
      const err = (await res.json()) as { error: APIError };
      window.alert(
        `Failed to update the Data Source (contact support@dust.tt for assistance) (internal error: type=${err.error.type} message=${err.error.message})`
      );
    }
    await mutateDataSourceViews();
    await mutateAgentConfigurations();
  };

  return (
    <AppLayout
      subscription={subscription}
      hideSidebar
      owner={owner}
      titleChildren={
        <AppLayoutSimpleCloseTitle
          title="Manage Dust Assistant"
          onClose={async () => {
            await router.push(`/w/${owner.sId}/builder/assistants`);
          }}
        />
      }
    >
      <div className="h-12" />
      <Page.Header
        title="Dust Assistant"
        icon={LogoSquareColorLogo}
        description="The Dust assistant is a general purpose assistant that has context on your company data."
      />
      <div className="flex flex-col space-y-8 pb-8 pt-8">
        <div className="flex w-full flex-col gap-4">
          {!!spaceDataSourceViews.length && (
            <>
              <Page.SectionHeader
                title="Availability"
                description="The Dust assistant requres at least one data source to be enabled."
              />

              <ContextItem
                title="Enable the Dust assistant for this workspace."
                visual={
                  <Avatar
                    visual="https://dust.tt/static/systemavatar/dust_avatar_full.png"
                    size="xs"
                  />
                }
                action={
                  <SliderToggle
                    selected={dustAgentConfiguration?.status === "active"}
                    onClick={async () => {
                      await handleToggleAgentStatus(dustAgentConfiguration);
                    }}
                    disabled={
                      dustAgentConfiguration?.status ===
                      "disabled_free_workspace"
                    }
                  />
                }
              />
            </>
          )}
          {spaceDataSourceViews.length &&
          dustAgentConfiguration?.status !== "disabled_by_admin" ? (
            <>
              <Page.SectionHeader
                title="Data Sources and Connections"
                description="Configure which connections and data sources will be searched by the Dust assistant."
              />
              <>
                {
                  <ContextItem.List>
                    {sortedDatasources.map((dsView) => (
                      <ContextItem
                        key={dsView.id}
                        title={getDisplayNameForDataSource(dsView.dataSource)}
                        visual={
                          <ContextItem.Visual
                            visual={getConnectorProviderLogoWithFallback(
                              dsView.dataSource.connectorProvider,
                              CloudArrowDownIcon
                            )}
                          />
                        }
                        action={
                          <SliderToggle
                            selected={
                              dsView.dataSource.assistantDefaultSelected
                            }
                            onClick={async () => {
                              await updateDatasourceSettings(
                                {
                                  assistantDefaultSelected:
                                    !dsView.dataSource.assistantDefaultSelected,
                                },
                                dsView.dataSource
                              );
                            }}
                          />
                        }
                      />
                    ))}
                  </ContextItem.List>
                }
              </>
            </>
          ) : dustAgentConfiguration?.status ===
            "disabled_missing_datasource" ? (
            <>
              <Page.SectionHeader
                title="This workspace doesn't currently have any data sources."
                description="Add connections or data sources to enable the Dust assistant."
                action={{
                  label: "Add connections",
                  variant: "primary",
                  icon: PlusIcon,
                  onClick: async () => {
                    await router.push(
                      `/w/${owner.sId}/builder/data-sources/managed`
                    );
                  },
                }}
              />
            </>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
