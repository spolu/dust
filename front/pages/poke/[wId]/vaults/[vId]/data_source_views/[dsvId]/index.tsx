import {
  DataSourceViewContentNode,
  defaultSelectionConfiguration,
  WorkspaceType,
  type DataSourceViewType,
  type LightWorkspaceType,
} from "@dust-tt/types";
import type { InferGetServerSidePropsType } from "next";

import { DataSourceViewSelector } from "@app/components/data_source_view/DataSourceViewSelector";
import PokeNavbar from "@app/components/poke/PokeNavbar";
import { withSuperUserAuthRequirements } from "@app/lib/iam/session";
import { DataSourceViewResource } from "@app/lib/resources/data_source_view_resource";
import { Page } from "@dust-tt/sparkle";
import { ViewDataSourceViewTable } from "@app/components/poke/data_source_views/view";
import { ReactElement } from "react";
import PokeLayout from "@app/pages/poke/PokeLayout";

export const getServerSideProps = withSuperUserAuthRequirements<{
  dataSourceView: DataSourceViewType;
  owner: WorkspaceType;
}>(async (context, auth) => {
  const owner = auth.getNonNullableWorkspace();

  const { dsvId } = context.params || {};
  if (typeof dsvId !== "string") {
    return {
      notFound: true,
    };
  }

  const dataSourceView = await DataSourceViewResource.fetchById(auth, dsvId, {
    includeEditedBy: true,
  });
  if (!dataSourceView) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      owner,
      dataSourceView: dataSourceView.toJSON(),
    },
  };
});

export default function DataSourceViewPage({
  dataSourceView,
  owner,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <div className="flex flex-row gap-6">
      <ViewDataSourceViewTable dataSourceView={dataSourceView} owner={owner} />
      <div className="border-material-200 my-4 flex flex-grow flex-col rounded-lg border p-4">
        <DataSourceViewSelector
          owner={owner}
          readonly
          selectionConfiguration={defaultSelectionConfiguration(dataSourceView)}
          setSelectionConfigurations={() => {}}
          viewType="documents"
        />
      </div>
    </div>
  );
}

DataSourceViewPage.getLayout = (page: ReactElement) => {
  return <PokeLayout>{page}</PokeLayout>;
};
