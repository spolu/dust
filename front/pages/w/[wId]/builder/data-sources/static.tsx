import {
  Button,
  Cog6ToothIcon,
  ContextItem,
  DocumentDuplicateIcon,
  FolderOpenIcon,
  Page,
  PageHeader,
  PlusIcon,
  SectionHeader,
} from "@dust-tt/sparkle";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useRouter } from "next/router";

import AppLayout from "@app/components/sparkle/AppLayout";
import { subNavigationAdmin } from "@app/components/sparkle/navigation";
import { getDataSources } from "@app/lib/api/data_sources";
import { Authenticator, getSession, getUserFromSession } from "@app/lib/auth";
import { DataSourceType } from "@app/types/data_source";
import { UserType, WorkspaceType } from "@app/types/user";

const { GA_TRACKING_ID = "" } = process.env;

export const getServerSideProps: GetServerSideProps<{
  user: UserType | null;
  owner: WorkspaceType;
  readOnly: boolean;
  dataSources: DataSourceType[];
  gaTrackingId: string;
}> = async (context) => {
  const session = await getSession(context.req, context.res);

  const user = await getUserFromSession(session);
  if (!user) {
    return {
      notFound: true,
    };
  }

  const auth = await Authenticator.fromSession(
    session,
    context.params?.wId as string
  );

  const owner = auth.workspace();
  if (!owner) {
    return {
      notFound: true,
    };
  }

  const readOnly = !auth.isBuilder();

  const allDataSources = await getDataSources(auth);
  const dataSources = allDataSources.filter((ds) => !ds.connectorId);

  return {
    props: {
      user,
      owner,
      readOnly,
      dataSources,
      gaTrackingId: GA_TRACKING_ID,
    },
  };
};

export default function DataSourcesView({
  user,
  owner,
  readOnly,
  dataSources,
  gaTrackingId,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();

  return (
    <AppLayout
      user={user}
      owner={owner}
      gaTrackingId={gaTrackingId}
      topNavigationCurrent="settings"
      subNavigation={subNavigationAdmin({
        owner,
        current: "data_sources_static",
      })}
    >
      <Page.Vertical gap="lg" align="stretch">
        <div className="flex flex-col gap-4 pb-4">
          <PageHeader
            title="Data Sources"
            icon={DocumentDuplicateIcon}
            description="Make data available to the workspace. Manage the data manually or by API."
          />

          <SectionHeader
            title="Data Sources"
            description="Make uploaded text files (doc, pdf, text, ...) available to Dust."
            action={
              !readOnly
                ? {
                    label: "Add a new Data Source",
                    variant: "secondary",
                    icon: PlusIcon,
                    onClick: () => {
                      // Enforce plan limits: DataSources count.
                      if (
                        owner.plan.limits.dataSources.count != -1 &&
                        dataSources.length >=
                          owner.plan.limits.dataSources.count
                      ) {
                        window.alert(
                          "You are limited to 1 DataSource on our free plan. Contact team@dust.tt if you want to increase this limit."
                        );
                        return;
                      } else {
                        void router.push(
                          `/w/${owner.sId}/builder/data-sources/new`
                        );
                      }
                    },
                  }
                : undefined
            }
          />

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
                action={
                  <Button.List>
                    <Button
                      variant="secondary"
                      icon={Cog6ToothIcon}
                      onClick={() => {
                        void router.push(
                          `/w/${owner.sId}/builder/data-sources/${ds.name}`
                        );
                      }}
                      label="Manage"
                    />
                  </Button.List>
                }
              >
                <ContextItem.Description>
                  <div className="text-sm text-element-700">
                    {ds.description}
                  </div>
                </ContextItem.Description>
              </ContextItem>
            ))}
          </ContextItem.List>
        </div>
      </Page.Vertical>
    </AppLayout>
  );
}
