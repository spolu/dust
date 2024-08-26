import { PencilSquareIcon, TrashIcon } from "@dust-tt/sparkle";
import type {
  DataSourceViewType,
  LightContentNode,
  PlanType,
  WorkspaceType,
} from "@dust-tt/types";
import { isFolder, isWebsite } from "@dust-tt/types";

import { DocumentDeleteDialog } from "@app/components/data_source/DocumentDeleteDialog";
import { DocumentUploadOrEditModal } from "@app/components/data_source/DocumentUploadOrEditModal";
import { MultipleDocumentsUpload } from "@app/components/data_source/MultipleDocumentsUpload";
import { TableDeleteDialog } from "@app/components/data_source/TableDeleteDialog";
import { TableUploadOrEditModal } from "@app/components/data_source/TableUploadOrEditModal";

export type ContentAction = {
  key:
    | "DocumentUploadOrEditModal"
    | "MultipleDocumentsUpload"
    | "DocumentDeleteDialog"
    | "TableUploadOrEditModal"
    | "TableDeleteDialog";
  contentNode?: LightContentNode;
};

type ContentActionsProps = {
  dataSourceView: DataSourceViewType;
  plan: PlanType;
  owner: WorkspaceType;
  onSave: () => void;
  currentAction: ContentAction | null;
  setCurrentAction: (action: ContentAction | null) => void;
};

export const ContentActions = ({
  dataSourceView,
  owner,
  plan,
  onSave,
  currentAction,
  setCurrentAction,
}: ContentActionsProps) => {
  const onClose = (save: boolean) => {
    setCurrentAction(null);
    if (save) {
      onSave();
    }
  };
  return (
    <>
      <DocumentUploadOrEditModal
        contentNode={currentAction?.contentNode}
        dataSourceView={dataSourceView}
        isOpen={currentAction?.key === "DocumentUploadOrEditModal"}
        onClose={onClose}
        owner={owner}
        plan={plan}
      />
      <MultipleDocumentsUpload
        dataSourceView={dataSourceView}
        isOpen={currentAction?.key === "MultipleDocumentsUpload"}
        onClose={onClose}
        owner={owner}
        plan={plan}
      />
      <DocumentDeleteDialog
        contentNode={currentAction?.contentNode}
        dataSourceView={dataSourceView}
        isOpen={currentAction?.key === "DocumentDeleteDialog"}
        onClose={onClose}
        owner={owner}
      />
      <TableUploadOrEditModal
        contentNode={currentAction?.contentNode}
        dataSourceView={dataSourceView}
        isOpen={currentAction?.key === "TableUploadOrEditModal"}
        onClose={onClose}
        owner={owner}
        plan={plan}
      />
      <TableDeleteDialog
        contentNode={currentAction?.contentNode}
        dataSourceView={dataSourceView}
        isOpen={currentAction?.key === "TableDeleteDialog"}
        onClose={onClose}
        owner={owner}
      />
    </>
  );
};

export const getFolderMenuItems = (contentNode: LightContentNode) => {
  if (contentNode.type === "file") {
    return [
      {
        label: "Edit",
        icon: PencilSquareIcon,
        key: "DocumentUploadOrEditModal" as const,
      },
      {
        label: "Delete",
        icon: TrashIcon,
        key: "DocumentDeleteDialog" as const,
        variant: "warning",
      },
    ];
  }

  if (contentNode.type === "database") {
    return [
      {
        label: "Edit",
        icon: PencilSquareIcon,
        key: "TableUploadOrEditModal" as const,
      },
      {
        label: "Delete",
        icon: TrashIcon,
        key: "TableDeleteDialog" as const,
        variant: "warning",
      },
    ];
  }

  return [];
};

export const getWebfolderMenuItems = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  contentNode: LightContentNode
) => {
  // TODO Actions for webrawler datasource
  return [];
};

export const getConnectedDataSourceMenuItems = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  contentNode: LightContentNode
) => {
  // TODO Actions for managed datasource
  return [];
};

export const getMenuItems = (
  dataSourceView: DataSourceViewType,
  contentNode: LightContentNode
) => {
  if (isFolder(dataSourceView.dataSource)) {
    return getFolderMenuItems(contentNode);
  }
  if (isWebsite(dataSourceView.dataSource)) {
    return getWebfolderMenuItems(contentNode);
  }
  return getConnectedDataSourceMenuItems(contentNode);
};
