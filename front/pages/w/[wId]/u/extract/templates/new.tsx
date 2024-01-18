import type { UserType, WorkspaceType } from "@dust-tt/types";
import type { SubscriptionType } from "@dust-tt/types";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";

import AppLayout from "@app/components/sparkle/AppLayout";
import { subNavigationBuild } from "@app/components/sparkle/navigation";
import { ExtractEventSchemaForm } from "@app/components/use/EventSchemaForm";
import { Authenticator, getSession, getUserFromSession } from "@app/lib/auth";

const { GA_TRACKING_ID = "" } = process.env;
export const getServerSideProps: GetServerSideProps<{
  user: UserType | null;
  owner: WorkspaceType;
  subscription: SubscriptionType;
  readOnly: boolean;
  gaTrackingId: string;
}> = async (context) => {
  const session = await getSession(context.req, context.res);
  const user = await getUserFromSession(session);
  const auth = await Authenticator.fromSession(
    session,
    context.params?.wId as string
  );
  const owner = auth.workspace();
  const subscription = auth.subscription();
  if (!owner || !auth.isBuilder() || !subscription) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      user,
      owner,
      subscription,
      readOnly: !auth.isBuilder(),
      gaTrackingId: GA_TRACKING_ID,
    },
  };
};

export default function AppExtractEventsCreate({
  user,
  owner,
  subscription,
  readOnly,
  gaTrackingId,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <AppLayout
      subscription={subscription}
      user={user}
      owner={owner}
      gaTrackingId={gaTrackingId}
      topNavigationCurrent="admin"
      subNavigation={subNavigationBuild({ owner, current: "extract" })}
    >
      <ExtractEventSchemaForm owner={owner} readOnly={readOnly} />
    </AppLayout>
  );
}
