import {
  Button,
  CloudArrowUpIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  NewDropdownMenu,
  NewDropdownMenuContent,
  NewDropdownMenuItem,
  NewDropdownMenuTrigger,
  PlusIcon,
  TableIcon,
  Tooltip,
} from "@dust-tt/sparkle";
import type {
  DataSourceViewType,
  LightWorkspaceType,
  SpaceType,
} from "@dust-tt/types";
import type { RefObject } from "react";
import { useState } from "react";

import type { ContentActionsRef } from "@app/components/spaces/ContentActions";
import SpaceFolderModal from "@app/components/spaces/SpaceFolderModal";
import { useDataSources } from "@app/lib/swr/data_sources";

interface FoldersHeaderMenuProps {
  canWriteInSpace: boolean;
  contentActionsRef: RefObject<ContentActionsRef>;
  folder: DataSourceViewType;
  owner: LightWorkspaceType;
  space: SpaceType;
}

export const FoldersHeaderMenu = ({
  canWriteInSpace,
  contentActionsRef,
  folder,
  owner,
  space,
}: FoldersHeaderMenuProps) => {
  return (
    <>
      {canWriteInSpace ? (
        <AddDataDropDownButton
          contentActionsRef={contentActionsRef}
          canWriteInSpace={canWriteInSpace}
        />
      ) : (
        <Tooltip
          label={
            space.kind === "global"
              ? `Only builders of the workspace can add data in the Company Data space.`
              : `Only members of the space can add data.`
          }
          side="top"
          trigger={
            <AddDataDropDownButton
              contentActionsRef={contentActionsRef}
              canWriteInSpace={canWriteInSpace}
            />
          }
        />
      )}
      {canWriteInSpace ? (
        <EditFolderButton
          owner={owner}
          space={space}
          folder={folder}
          canWriteInSpace={canWriteInSpace}
        />
      ) : (
        <Tooltip
          label={
            space.kind === "global"
              ? `Only builders of the workspace can edit a folder in the Company Data space.`
              : `Only members of the space can edit a folder.`
          }
          side="top"
          trigger={
            <EditFolderButton
              owner={owner}
              space={space}
              folder={folder}
              canWriteInSpace={canWriteInSpace}
            />
          }
        />
      )}
    </>
  );
};

type AddDataDropDrownButtonProps = {
  contentActionsRef: RefObject<ContentActionsRef>;
  canWriteInSpace: boolean;
};

const AddDataDropDownButton = ({
  contentActionsRef,
  canWriteInSpace,
}: AddDataDropDrownButtonProps) => {
  return (
    <NewDropdownMenu>
      <NewDropdownMenuTrigger asChild>
        <Button
          size="sm"
          label="Add data"
          icon={PlusIcon}
          variant="primary"
          isSelect
          disabled={!canWriteInSpace}
        />
      </NewDropdownMenuTrigger>
      <NewDropdownMenuContent>
        <NewDropdownMenuItem
          icon={DocumentTextIcon}
          onClick={() => {
            contentActionsRef.current?.callAction("DocumentUploadOrEdit");
          }}
          label="Create a document"
        />
        <NewDropdownMenuItem
          icon={TableIcon}
          onClick={() => {
            contentActionsRef.current?.callAction("TableUploadOrEdit");
          }}
          label="Create a table"
        />
        <NewDropdownMenuItem
          icon={CloudArrowUpIcon}
          onClick={() => {
            contentActionsRef.current?.callAction("MultipleDocumentsUpload");
          }}
          label="Upload multiple files"
        />
      </NewDropdownMenuContent>
    </NewDropdownMenu>
  );
};

interface EditFolderButtonProps {
  canWriteInSpace: boolean;
  folder: DataSourceViewType;
  owner: LightWorkspaceType;
  space: SpaceType;
}

const EditFolderButton = ({
  canWriteInSpace,
  folder,
  owner,
  space,
}: EditFolderButtonProps) => {
  const { dataSources } = useDataSources(owner);

  const [showEditFolderModal, setShowEditFolderModal] = useState(false);

  return (
    <>
      <SpaceFolderModal
        isOpen={showEditFolderModal}
        onClose={() => {
          setShowEditFolderModal(false);
        }}
        owner={owner}
        space={space}
        dataSources={dataSources}
        dataSourceViewId={folder.sId}
      />
      <Button
        size="sm"
        label="Edit folder"
        icon={Cog6ToothIcon}
        variant="primary"
        onClick={() => {
          setShowEditFolderModal(true);
        }}
        disabled={!canWriteInSpace}
      />
    </>
  );
};
