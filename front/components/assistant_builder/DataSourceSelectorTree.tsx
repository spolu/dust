import { Tree } from "@dust-tt/sparkle";
import type {
  ContentNode,
  DataSourceType,
  WorkspaceType,
} from "@dust-tt/types";
import { useEffect, useState } from "react";

import { useParentResourcesById } from "@app/hooks/useParentResourcesById";
import { useConnectorPermissions } from "@app/lib/swr";

export function DataSourceSelectorTreeChildren({
  owner,
  dataSource,
  parentId,
  parents,
  parentIsSelected,
  selectedParents,
  showExpand,
  selectedResources,
  onSelectChange,
}: {
  owner: WorkspaceType;
  dataSource: DataSourceType;
  parentId: string | null;
  parents: string[];
  parentIsSelected?: boolean;
  selectedParents: string[];
  showExpand?: boolean;
  selectedResources: ContentNode[];
  onSelectChange: (
    resource: ContentNode,
    parents: string[],
    checked: boolean
  ) => void;
}) {
  const { resources, isResourcesLoading, isResourcesError } =
    useConnectorPermissions({
      owner,
      dataSource,
      parentId,
      filterPermission: "read",
    });

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (isResourcesError) {
    return (
      <div className="text-warning text-sm">
        Failed to retrieve permissions likely due to a revoked authorization.
      </div>
    );
  }

  useEffect(() => {
    if (parentIsSelected) {
      // Unselected previously selected children
      resources
        .filter((r) =>
          selectedResources.find((value) => value.internalId === r.internalId)
        )
        .forEach((r) => {
          onSelectChange(r, parents, false);
        });
    }
  }, [resources, parentIsSelected, selectedResources, onSelectChange, parents]);

  return (
    <Tree isLoading={isResourcesLoading}>
      {resources.map((r) => {
        const isSelected = Boolean(
          selectedResources.find((value) => value.internalId === r.internalId)
        );
        const partialChecked =
          !isSelected &&
          Boolean(selectedParents.find((id) => id === r.internalId));

        return (
          <Tree.Item
            key={r.internalId}
            collapsed={!expanded[r.internalId]}
            onChevronClick={() => {
              setExpanded((prev) => ({
                ...prev,
                [r.internalId]: prev[r.internalId] ? false : true,
              }));
            }}
            type={r.expandable ? "node" : "leaf"}
            label={r.title}
            variant={r.type}
            className="whitespace-nowrap"
            checkbox={
              r.preventSelection !== true
                ? {
                    disabled: parentIsSelected,
                    checked: parentIsSelected || isSelected,
                    partialChecked,
                    onChange: (checked) => {
                      onSelectChange(r, parents, checked);
                    },
                  }
                : undefined
            }
          >
            {expanded[r.internalId] && (
              <DataSourceSelectorTreeChildren
                owner={owner}
                dataSource={dataSource}
                parentId={r.internalId}
                showExpand={showExpand}
                parents={[...parents, r.internalId]}
                parentIsSelected={parentIsSelected || isSelected}
                selectedResources={selectedResources}
                selectedParents={selectedParents}
                onSelectChange={onSelectChange}
              />
            )}
          </Tree.Item>
        );
      })}
    </Tree>
  );
}

export function DataSourceSelectorTree({
  owner,
  dataSource,
  showExpand,
  parentIsSelected,
  selectedResources,
  onSelectChange,
}: {
  owner: WorkspaceType;
  dataSource: DataSourceType;
  showExpand?: boolean;
  parentIsSelected?: boolean;
  selectedResources: ContentNode[];
  onSelectChange: (resource: ContentNode, checked: boolean) => void;
}) {
  const { parentsById, setParentsById } = useParentResourcesById({
    owner,
    dataSource,
    selectedResources,
  });
  const selectedParents = [
    ...new Set(Object.values(parentsById).flatMap((c) => [...c])),
  ];

  return (
    <div className="overflow-x-auto">
      <DataSourceSelectorTreeChildren
        owner={owner}
        dataSource={dataSource}
        parentId={null}
        showExpand={showExpand}
        parents={[]}
        parentIsSelected={parentIsSelected}
        selectedResources={selectedResources}
        selectedParents={selectedParents}
        onSelectChange={(resource, parents, selected) => {
          const newParentsById = { ...parentsById };
          if (selected) {
            newParentsById[resource.internalId] = new Set(parents);
          } else {
            delete newParentsById[resource.internalId];
          }
          setParentsById(newParentsById);
          onSelectChange(resource, selected);
        }}
      />
    </div>
  );
}
