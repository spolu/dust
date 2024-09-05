import {
  Button,
  DataTable,
  DropdownMenu,
  Searchbar,
  Spinner,
  useHashParam,
  usePaginationFromUrl,
} from "@dust-tt/sparkle";
import type {
  ContentNodesViewType,
  DataSourceViewContentNode,
  DataSourceViewType,
  PlanType,
  VaultType,
  WorkspaceType,
} from "@dust-tt/types";
import { isValidContentNodesViewType } from "@dust-tt/types";
import PlusIcon from "@heroicons/react/20/solid/esm/PlusIcon";
import type { CellContext, ColumnDef } from "@tanstack/react-table";
import { useMemo, useRef, useState } from "react";

import type {
  ContentActionKey,
  ContentActionsRef,
} from "@app/components/vaults/ContentActions";
import {
  ContentActions,
  getMenuItems,
} from "@app/components/vaults/ContentActions";
import { FoldersHeaderMenu } from "@app/components/vaults/FoldersHeaderMenu";
import { WebsitesHeaderMenu } from "@app/components/vaults/WebsitesHeaderMenu";
import { getVisualForContentNode } from "@app/lib/content_nodes";
import { isFolder, isWebsite } from "@app/lib/data_sources";
import { useDataSourceViewContentNodes } from "@app/lib/swr/data_source_views";
import { classNames, formatTimestampToFriendlyDate } from "@app/lib/utils";

type RowData = DataSourceViewContentNode & {
  icon: React.ComponentType;
  onClick?: () => void;
};

type VaultDataSourceViewContentListProps = {
  vault: VaultType;
  dataSourceView: DataSourceViewType;
  plan: PlanType;
  canWriteInVault: boolean;
  canReadInVault: boolean;
  onSelect: (parentId: string) => void;
  owner: WorkspaceType;
  parentId?: string;
};

const getTableColumns = (): ColumnDef<RowData, string>[] => {
  const columns: ColumnDef<RowData, string>[] = [
    {
      header: "Name",
      accessorKey: "title",
      id: "title",
      sortingFn: "text", // built-in sorting function case-insensitive
      cell: (info: CellContext<RowData, unknown>) => (
        <DataTable.CellContent icon={info.row.original.icon}>
          <span className="font-bold">{info.row.original.title}</span>
        </DataTable.CellContent>
      ),
    },
    {
      header: "Last updated",
      accessorKey: "lastUpdatedAt",
      id: "lastUpdatedAt",
      sortingFn: "text", // built-in sorting function case-insensitive
      cell: (info: CellContext<RowData, unknown>) => {
        const { lastUpdatedAt } = info.row.original;

        if (!lastUpdatedAt) {
          return <DataTable.CellContent>-</DataTable.CellContent>;
        }

        return (
          <DataTable.CellContent>
            {formatTimestampToFriendlyDate(lastUpdatedAt, "short")}
          </DataTable.CellContent>
        );
      },
    },
  ];

  return columns;
};

export const VaultDataSourceViewContentList = ({
  owner,
  vault,
  dataSourceView,
  plan,
  canWriteInVault,
  canReadInVault,
  onSelect,
  parentId,
}: VaultDataSourceViewContentListProps) => {
  const [dataSourceSearch, setDataSourceSearch] = useState<string>("");
  const contentActionsRef = useRef<ContentActionsRef>(null);

  const { pagination, setPagination } = usePaginationFromUrl({
    urlPrefix: "table",
  });
  const [viewType, setViewType] = useHashParam("viewType", "documents");

  const handleViewTypeChange = (newViewType: ContentNodesViewType) => {
    if (newViewType !== viewType) {
      setPagination({ pageIndex: 0, pageSize: pagination.pageSize }, "replace");
      setViewType(newViewType);
    }
  };

  const {
    isNodesLoading,
    mutateDataSourceViewContentNodes,
    nodes,
    totalNodesCount,
  } = useDataSourceViewContentNodes({
    dataSourceView,
    owner,
    internalIds: parentId ? [parentId] : undefined,
    includeChildren: true,
    pagination,
    viewType: isValidContentNodesViewType(viewType) ? viewType : "documents",
  });

  const rows: RowData[] = useMemo(
    () =>
      nodes?.map((contentNode) => ({
        ...contentNode,
        icon: getVisualForContentNode(contentNode),
        ...(contentNode.expandable && {
          onClick: () => {
            if (contentNode.expandable) {
              onSelect(contentNode.internalId);
            }
          },
        }),
        moreMenuItems: getMenuItems(
          canReadInVault,
          canWriteInVault,
          dataSourceView,
          contentNode,
          contentActionsRef
        ),
      })) || [],
    [canWriteInVault, canReadInVault, dataSourceView, nodes, onSelect]
  );

  if (isNodesLoading) {
    return (
      <div className="mt-8 flex justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <div
        className={classNames(
          "flex gap-2",
          rows.length === 0
            ? "h-36 w-full max-w-4xl items-center justify-center rounded-lg border bg-structure-50"
            : ""
        )}
      >
        {rows.length > 0 ? (
          <>
            <Searchbar
              name="search"
              placeholder="Search (Name)"
              value={dataSourceSearch}
              onChange={(s) => {
                setDataSourceSearch(s);
              }}
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-sm text-element-700">
            <span>No data sources were added yet.</span>
            <Button
              variant="primary"
              icon={PlusIcon}
              label="Add data"
              onClick={() => {
                void router.push(
                  `/w/${owner.sId}/data-sources/vaults/${vault.sId}/categories/${dataSourceView.category}`
                );
              }}
            />
          </div>
        )}
        {isFolder(dataSourceView.dataSource) && (
          <>
            <DropdownMenu>
              <DropdownMenu.Button>
                <Button
                  size="sm"
                  label={viewType === "documents" ? "Documents" : "Tables"}
                  variant="secondary"
                  type="menu"
                />
              </DropdownMenu.Button>

              <DropdownMenu.Items>
                <DropdownMenu.Item
                  label="Documents"
                  onClick={() => handleViewTypeChange("documents")}
                />
                <DropdownMenu.Item
                  label="Tables"
                  onClick={() => handleViewTypeChange("tables")}
                />
              </DropdownMenu.Items>
            </DropdownMenu>
            <FoldersHeaderMenu
              owner={owner}
              vault={vault}
              canWriteInVault={canWriteInVault}
              folder={dataSourceView.dataSource}
              contentActionsRef={contentActionsRef}
            />
          </>
        )}
        {isWebsite(dataSourceView.dataSource) && (
          <WebsitesHeaderMenu
            owner={owner}
            vault={vault}
            canWriteInVault={canWriteInVault}
            dataSourceView={dataSourceView}
          />
        )}
      </div>
      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={getTableColumns()}
          filter={dataSourceSearch}
          filterColumn="title"
          initialColumnOrder={[{ desc: false, id: "title" }]}
          totalRowCount={totalNodesCount}
          pagination={pagination}
          setPagination={setPagination}
        />
      )}
      <ContentActions
        ref={contentActionsRef}
        dataSourceView={dataSourceView}
        totalNodesCount={totalNodesCount}
        owner={owner}
        plan={plan}
        onSave={async (action?: ContentActionKey) => {
          if (action === "DocumentUploadOrEdit") {
            handleViewTypeChange("documents");
          } else if (action === "TableUploadOrEdit") {
            handleViewTypeChange("tables");
          }

          await mutateDataSourceViewContentNodes();
        }}
      />
    </>
  );
};
