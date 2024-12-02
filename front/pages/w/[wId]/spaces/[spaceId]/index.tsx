import { Chip, InformationCircleIcon, Page } from "@dust-tt/sparkle";
import type { InferGetServerSidePropsType } from "next";
import { useRouter } from "next/router";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";

import { CreateOrEditSpaceModal } from "@app/components/spaces/CreateOrEditSpaceModal";
import { SpaceCategoriesList } from "@app/components/spaces/SpaceCategoriesList";
import type { SpaceLayoutProps } from "@app/components/spaces/SpaceLayout";
import { SpaceLayout } from "@app/components/spaces/SpaceLayout";
import { withDefaultUserAuthRequirements } from "@app/lib/iam/session";
import { SpaceResource } from "@app/lib/resources/space_resource";
import { getSpaceIcon, getSpaceName } from "@app/lib/spaces";
import { useSpaceInfo } from "@app/lib/swr/spaces";

export const getServerSideProps = withDefaultUserAuthRequirements<
  SpaceLayoutProps & { userId: string }
>(async (context, auth) => {
  const owner = auth.getNonNullableWorkspace();
  const subscription = auth.subscription();
  const isAdmin = auth.isAdmin();
  const plan = auth.getNonNullablePlan();

  const { spaceId } = context.query;
  if (!subscription || typeof spaceId !== "string") {
    return {
      notFound: true,
    };
  }

  const space = await SpaceResource.fetchById(auth, spaceId);
  if (!space || !space.canList(auth)) {
    return {
      notFound: true,
    };
  }

  // No root page for System spaces since it contains only managed data sources.
  if (space.isSystem()) {
    return {
      redirect: {
        destination: `/w/${owner.sId}/spaces/${space.sId}/categories/managed`,
        permanent: false,
      },
    };
  }

  return {
    props: {
      isAdmin,
      owner,
      plan,
      space: space.toJSON(),
      subscription,
      userId: auth.getNonNullableUser().sId,
    },
  };
});

export default function Space({
  isAdmin,
  owner,
  userId,
  space,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { spaceInfo } = useSpaceInfo({
    workspaceId: owner.sId,
    spaceId: space.sId,
  });

  const router = useRouter();
  const [showSpaceEditionModal, setShowSpaceEditionModal] = useState(false);
  const isMember = useMemo(
    () => spaceInfo?.members?.some((m) => m.sId === userId),
    [userId, spaceInfo?.members]
  );

  return (
    <Page.Vertical gap="xl" align="stretch">
      <Page.Header title={getSpaceName(space)} icon={getSpaceIcon(space)} />
      {spaceInfo && !isMember && (
        <div>
          <Chip
            color="pink"
            label="You are not a member of this space."
            size="sm"
            icon={InformationCircleIcon}
          />
        </div>
      )}
      <SpaceCategoriesList
        owner={owner}
        space={space}
        onSelect={(category) => {
          void router.push(
            `/w/${owner.sId}/spaces/${space.sId}/categories/${category}`
          );
        }}
        onButtonClick={() => setShowSpaceEditionModal(true)}
        isAdmin={isAdmin}
      />
      <CreateOrEditSpaceModal
        owner={owner}
        isOpen={showSpaceEditionModal}
        onClose={() => setShowSpaceEditionModal(false)}
        space={space}
        isAdmin={isAdmin}
      />
    </Page.Vertical>
  );
}

Space.getLayout = (page: ReactElement, pageProps: any) => {
  return <SpaceLayout pageProps={pageProps}>{page}</SpaceLayout>;
};
