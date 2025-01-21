import { ContextItem, Page, Spinner, TextArea } from "@dust-tt/sparkle";
import type { WorkspaceType } from "@dust-tt/types";
import { JsonViewer } from "@textea/json-viewer";
import type { InferGetServerSidePropsType } from "next";

import PokeNavbar from "@app/components/poke/PokeNavbar";
import { withSuperUserAuthRequirements } from "@app/lib/iam/session";
import { formatTimestampToFriendlyDate } from "@app/lib/utils";
import { usePokeTracker } from "@app/poke/swr/trackers";

export const getServerSideProps = withSuperUserAuthRequirements<{
  owner: WorkspaceType;
  trackerId: string;
}>(async (context, auth) => {
  const owner = auth.getNonNullableWorkspace();
  const { tId } = context.params || {};

  if (typeof tId !== "string") {
    return { notFound: true };
  }

  return {
    props: {
      owner,
      trackerId: tId,
    },
  };
});

export default function TrackerDetailPage({
  owner,
  trackerId,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { data, isLoading, isError } = usePokeTracker({
    owner,
    tId: trackerId,
  });

  if (isLoading) {
    return <Spinner />;
  }

  if (isError || !data) {
    return <div>Error loading tracker</div>;
  }

  return (
    <div className="min-h-screen bg-structure-50">
      <PokeNavbar />
      <div className="mx-auto max-w-4xl pt-8">
        <Page.Vertical align="stretch">
          <ContextItem.List>
            <ContextItem title={`${data.name} (${data.sId})`} visual={<></>}>
              <ContextItem.Description>
                <div className="flex flex-col gap-2">
                  <div className="ml-4 pt-2 text-sm text-element-700">
                    <div className="font-bold">Created At:</div>
                    <div>{formatTimestampToFriendlyDate(data.createdAt)}</div>
                  </div>
                  <div className="ml-4 text-sm text-element-700">
                    <div className="font-bold">Prompt:</div>
                    <TextArea value={data.prompt ?? ""} />
                  </div>
                  <div className="ml-4 pt-2 text-sm text-element-700">
                    <div className="font-bold">Raw Data</div>
                    <JsonViewer value={data} defaultInspectDepth={0} />
                  </div>
                </div>
              </ContextItem.Description>
            </ContextItem>
          </ContextItem.List>
        </Page.Vertical>
      </div>
    </div>
  );
}
