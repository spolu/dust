import {
  Button,
  CloudArrowLeftRightIcon,
  CommandLineIcon,
  FolderIcon,
  GlobeAltIcon,
  Item,
  NavigationListLabel,
  PlusIcon,
  Tree,
} from "@dust-tt/sparkle";
import type {
  AppType,
  DataSourceViewCategory,
  DataSourceViewContentNode,
  DataSourceViewType,
  LightWorkspaceType,
  SpaceType,
} from "@dust-tt/types";
import { assertNever, DATA_SOURCE_VIEW_CATEGORIES } from "@dust-tt/types";
import { sortBy, uniqBy } from "lodash";
import { useRouter } from "next/router";
import type { ComponentType, ReactElement } from "react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { getConnectorProviderLogoWithFallback } from "@app/lib/connector_providers";
import { getVisualForContentNode } from "@app/lib/content_nodes";
import { getDataSourceNameFromView } from "@app/lib/data_sources";
import type { SpaceSectionGroupType } from "@app/lib/spaces";
import { getSpaceIcon, getSpaceName, groupSpaces } from "@app/lib/spaces";
import { useApps } from "@app/lib/swr/apps";
import { useDataSourceViewContentNodes } from "@app/lib/swr/data_source_views";
import {
  useSpaceDataSourceViews,
  useSpaceInfo,
  useSpaces,
  useSpacesAsAdmin,
} from "@app/lib/swr/spaces";

interface SpaceSideBarMenuProps {
  owner: LightWorkspaceType;
  isAdmin: boolean;
  openSpaceCreationModal?: ({
    defaultRestricted,
  }: {
    defaultRestricted: boolean;
  }) => void;
}

export default function SpaceSideBarMenu({
  owner,
  isAdmin,
  openSpaceCreationModal,
}: SpaceSideBarMenuProps) {
  const { spaces: spacesAsAdmin, isSpacesLoading: isSpacesAsAdminLoading } =
    useSpacesAsAdmin({
      workspaceId: owner.sId,
      disabled: !isAdmin,
    });

  const { spaces: spacesAsUser, isSpacesLoading: isSpacesAsUserLoading } =
    useSpaces({
      workspaceId: owner.sId,
    });

  // Spaces that are in the spacesAsUser list should be displayed first, use the name as a tiebreaker.
  const compareSpaces = useCallback(
    (s1: SpaceType, s2: SpaceType) => {
      const s1IsMember = !!spacesAsUser.find((s) => s.sId === s1.sId);
      const s2IsMember = !!spacesAsUser.find((s) => s.sId === s2.sId);

      if (s1IsMember && !s2IsMember) {
        return -1;
      } else if (!s1IsMember && s2IsMember) {
        return 1;
      } else {
        return s1.name.localeCompare(s2.name);
      }
    },
    [spacesAsUser]
  );

  const spaces = useMemo(() => {
    return uniqBy(spacesAsAdmin.concat(spacesAsUser), "sId");
  }, [spacesAsAdmin, spacesAsUser]);

  if (isSpacesAsAdminLoading || isSpacesAsUserLoading || !spacesAsUser) {
    return <></>;
  }

  // Group by section and sort.
  const sortedGroupedSpaces = groupSpaces(spaces)
    // Remove the empty system menu for users & builders.
    .filter(
      ({ section, spaces }) => section !== "system" || spaces.length !== 0
    );

  return (
    <div className="flex h-0 min-h-full w-full overflow-y-auto">
      <div className="flex w-full flex-col px-2">
        <Item.List>
          {sortedGroupedSpaces.map(({ section, spaces }, index) => {
            // Public spaces are created manually by us to hold public dust apps - other workspaces
            // can't create them, so we do not show the section at all if there are no spaces.
            if (section === "public" && !spaces.length) {
              return null;
            }

            if (section === "restricted" && !spaces.length && !isAdmin) {
              return null;
            }

            const sectionDetails = getSpaceSectionDetails(section);

            return (
              <Fragment key={`space-section-${index}`}>
                <div className="flex items-center justify-between px-2 pr-0">
                  <NavigationListLabel
                    label={sectionDetails.label}
                    variant="secondary"
                  />
                  {sectionDetails.displayCreateSpaceButton &&
                    isAdmin &&
                    openSpaceCreationModal && (
                      <Button
                        className="mt-4"
                        size="xs"
                        variant="ghost"
                        label="New"
                        icon={PlusIcon}
                        onClick={() =>
                          openSpaceCreationModal({
                            defaultRestricted: sectionDetails.defaultRestricted,
                          })
                        }
                      />
                    )}
                </div>
                {renderSpaceItems(
                  spaces.toSorted(compareSpaces),
                  spacesAsUser,
                  owner
                )}
              </Fragment>
            );
          })}
        </Item.List>
      </div>
    </div>
  );
}

// Function to render space items.
const renderSpaceItems = (
  spaces: SpaceType[],
  spacesAsUser: SpaceType[],
  owner: LightWorkspaceType
) => {
  return spaces.map((space) => (
    <Fragment key={`space-${space.sId}`}>
      {space.kind === "system" ? (
        <SystemSpaceMenu owner={owner} space={space} />
      ) : (
        <SpaceMenu
          owner={owner}
          space={space}
          isMember={!!spacesAsUser.find((v) => v.sId === space.sId)}
        />
      )}
    </Fragment>
  ));
};

type SpaceSectionStructureType =
  | {
      label: string;
      displayCreateSpaceButton: true;
      defaultRestricted: boolean;
    }
  | {
      label: string;
      displayCreateSpaceButton: false;
    };

const getSpaceSectionDetails = (
  kind: SpaceSectionGroupType
): SpaceSectionStructureType => {
  switch (kind) {
    case "shared":
      return {
        label: "Open",
        displayCreateSpaceButton: true,
        defaultRestricted: false,
      };

    case "restricted":
      return {
        label: "Restricted",
        displayCreateSpaceButton: true,
        defaultRestricted: true,
      };

    case "system":
      return { label: "", displayCreateSpaceButton: false };

    case "public":
      return { label: "Public", displayCreateSpaceButton: false };

    default:
      assertNever(kind);
  }
};

// System space.

const SYSTEM_SPACE_ITEMS = [
  {
    label: "Connection Admin",
    visual: CloudArrowLeftRightIcon,
    category: "managed" as DataSourceViewCategory,
  },
];

const SystemSpaceMenu = ({
  owner,
  space,
}: {
  owner: LightWorkspaceType;
  space: SpaceType;
}) => {
  return (
    <Tree variant="navigator">
      {SYSTEM_SPACE_ITEMS.map((item) => (
        <SystemSpaceItem
          category={item.category as Exclude<DataSourceViewCategory, "apps">}
          key={item.label}
          label={item.label}
          owner={owner}
          space={space}
          visual={item.visual}
        />
      ))}
    </Tree>
  );
};

type IconType = ComponentType<{ className?: string }>;

const SystemSpaceItem = ({
  category,
  label,
  owner,
  space,
  visual,
}: {
  category: Exclude<DataSourceViewCategory, "apps">;
  label: string;
  owner: LightWorkspaceType;
  space: SpaceType;
  visual: IconType;
}) => {
  const router = useRouter();

  const itemPath = `/w/${owner.sId}/spaces/${space.sId}/categories/${category}`;
  const isAncestorToCurrentPage =
    router.asPath.startsWith(itemPath + "/") || router.asPath === itemPath;

  // Unfold the item if it's an ancestor of the current page.
  const [isExpanded, setIsExpanded] = useState(false);
  useEffect(() => {
    if (isAncestorToCurrentPage) {
      setIsExpanded(isAncestorToCurrentPage);
    }
  }, [isAncestorToCurrentPage]);

  const { isSpaceDataSourceViewsLoading, spaceDataSourceViews } =
    useSpaceDataSourceViews({
      workspaceId: owner.sId,
      spaceId: space.sId,
      category,
      disabled: !isExpanded,
    });

  return (
    <Tree.Item
      isNavigatable
      label={label}
      collapsed={!isExpanded}
      onItemClick={() => router.push(itemPath)}
      isSelected={router.asPath === itemPath}
      onChevronClick={() => setIsExpanded(!isExpanded)}
      visual={visual}
      areActionsFading={false}
    >
      {isExpanded && (
        <Tree isLoading={isSpaceDataSourceViewsLoading}>
          {spaceDataSourceViews.map((ds) => (
            <SpaceDataSourceViewItem
              item={ds}
              key={ds.sId}
              owner={owner}
              space={space}
            />
          ))}
        </Tree>
      )}
    </Tree.Item>
  );
};

// Global + regular spaces.

const SpaceMenu = ({
  owner,
  space,
  isMember,
}: {
  owner: LightWorkspaceType;
  space: SpaceType;
  isMember: boolean;
}) => {
  return (
    <Tree variant="navigator">
      <SpaceMenuItem owner={owner} space={space} isMember={isMember} />
    </Tree>
  );
};

const SpaceMenuItem = ({
  owner,
  space,
  isMember,
}: {
  owner: LightWorkspaceType;
  space: SpaceType;
  isMember: boolean;
}) => {
  const router = useRouter();

  const spacePath = `/w/${owner.sId}/spaces/${space.sId}`;
  const isAncestorToCurrentPage =
    router.asPath.startsWith(spacePath + "/") || router.asPath === spacePath;

  // Unfold the space if it's an ancestor of the current page.
  const [isExpanded, setIsExpanded] = useState(false);
  useEffect(() => {
    if (isAncestorToCurrentPage) {
      setIsExpanded(isAncestorToCurrentPage);
    }
  }, [isAncestorToCurrentPage]);

  const { spaceInfo, isSpaceInfoLoading } = useSpaceInfo({
    workspaceId: owner.sId,
    spaceId: space.sId,
    disabled: !isExpanded,
  });

  return (
    <Tree.Item
      isNavigatable
      label={getSpaceName(space)}
      collapsed={!isExpanded}
      onItemClick={() => router.push(spacePath)}
      isSelected={router.asPath === spacePath}
      onChevronClick={() => setIsExpanded(!isExpanded)}
      visual={getSpaceIcon(space)}
      tailwindIconTextColor={isMember ? undefined : "text-warning-400"}
      areActionsFading={false}
    >
      {isExpanded && (
        <Tree isLoading={isSpaceInfoLoading}>
          {spaceInfo?.categories &&
            DATA_SOURCE_VIEW_CATEGORIES.filter(
              (c) => !!spaceInfo.categories[c]
            ).map((c) => {
              if (c === "apps") {
                return (
                  <SpaceAppSubMenu
                    key={c}
                    category={c}
                    owner={owner}
                    space={space}
                  />
                );
              } else {
                return (
                  spaceInfo.categories[c] && (
                    <SpaceDataSourceViewSubMenu
                      key={c}
                      category={c}
                      owner={owner}
                      space={space}
                    />
                  )
                );
              }
            })}
        </Tree>
      )}
    </Tree.Item>
  );
};

const DATA_SOURCE_OR_VIEW_SUB_ITEMS: {
  [key: string]: {
    icon: ComponentType<{
      className?: string;
    }>;
    label: string;
  };
} = {
  managed: {
    icon: CloudArrowLeftRightIcon,
    label: "Connected Data",
  },
  folder: {
    icon: FolderIcon,
    label: "Folders",
  },
  website: {
    icon: GlobeAltIcon,
    label: "Websites",
  },
  apps: {
    icon: CommandLineIcon,
    label: "Apps",
  },
};

const SpaceDataSourceViewItem = ({
  item,
  owner,
  space,
  node,
}: {
  item: DataSourceViewType;
  owner: LightWorkspaceType;
  space: SpaceType;
  node?: DataSourceViewContentNode;
}): ReactElement => {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const { isNodesLoading, nodes } = useDataSourceViewContentNodes({
    dataSourceView: item,
    owner,
    parentId: node?.internalId,
    viewType: "documents",
    disabled: !isExpanded,
    swrOptions: {
      revalidateOnFocus: false,
    },
  });

  const basePath = `/w/${owner.sId}/spaces/${space.sId}/categories/${item.category}/data_source_views/${item.sId}`;

  // Load the currently selected node from router.query.parentId
  const {
    nodes: [selected],
  } = useDataSourceViewContentNodes({
    dataSourceView: item,
    owner,
    internalIds: [router.query.parentId as string],
    viewType: "documents",
    disabled: !router.asPath.startsWith(basePath) || !router.query.parentId,
  });

  // isAncestorToCurrentPage is true if :
  // 1. The current path matches the basePath
  // 2. Either the current node is the root (!node) or the current node is a parent of the selected node
  const isAncestorToCurrentPage =
    router.asPath.startsWith(basePath) &&
    (!node || (node && selected?.parentInternalIds?.includes(node.internalId)));

  // Unfold the folder if it's an ancestor of the current page.
  useEffect(() => {
    if (isAncestorToCurrentPage) {
      setIsExpanded(isAncestorToCurrentPage);
    }
  }, [isAncestorToCurrentPage]);

  const LogoComponent = node
    ? getVisualForContentNode(node)
    : getConnectorProviderLogoWithFallback(
        item.dataSource.connectorProvider,
        FolderIcon
      );

  const dataSourceViewPath = node
    ? `${basePath}?parentId=${node?.internalId}`
    : basePath;

  const isEmpty = isExpanded && !isNodesLoading && nodes.length === 0;
  const expandableNodes = nodes.filter((node) => node.expandable);
  const notExpandableNodes = nodes.filter((node) => !node.expandable);
  const notExpandableNodesLabel =
    notExpandableNodes.length === 1 ? "item" : "items";

  return (
    <Tree.Item
      isNavigatable
      type={isEmpty ? "leaf" : "node"}
      isSelected={router.asPath === dataSourceViewPath}
      onChevronClick={() => setIsExpanded(!isExpanded)}
      onItemClick={() => router.push(dataSourceViewPath)}
      collapsed={!isExpanded || isEmpty}
      label={node ? node.title : getDataSourceNameFromView(item)}
      visual={LogoComponent}
      areActionsFading={false}
    >
      {isExpanded && (
        <Tree isLoading={isNodesLoading}>
          {expandableNodes.map((node) => (
            <SpaceDataSourceViewItem
              item={item}
              key={node.internalId}
              owner={owner}
              space={space}
              node={node}
            />
          ))}
          {notExpandableNodes.length > 0 && (
            <Tree.Empty
              label={
                expandableNodes.length
                  ? `and ${notExpandableNodes.length} ${notExpandableNodesLabel}`
                  : `${notExpandableNodes.length} ${notExpandableNodesLabel}`
              }
              onItemClick={() => router.push(dataSourceViewPath)}
            />
          )}
        </Tree>
      )}
    </Tree.Item>
  );
};

const SpaceDataSourceViewSubMenu = ({
  owner,
  space,
  category,
}: {
  owner: LightWorkspaceType;
  space: SpaceType;
  category: Exclude<DataSourceViewCategory, "apps">;
}) => {
  const router = useRouter();

  const spaceCategoryPath = `/w/${owner.sId}/spaces/${space.sId}/categories/${category}`;
  const isAncestorToCurrentPage =
    router.asPath.startsWith(spaceCategoryPath + "/") ||
    router.asPath === spaceCategoryPath;

  // Unfold the space's category if it's an ancestor of the current page.
  const [isExpanded, setIsExpanded] = useState(false);
  useEffect(() => {
    if (isAncestorToCurrentPage) {
      setIsExpanded(isAncestorToCurrentPage);
    }
  }, [isAncestorToCurrentPage]);

  const categoryDetails = DATA_SOURCE_OR_VIEW_SUB_ITEMS[category];
  const { isSpaceDataSourceViewsLoading, spaceDataSourceViews } =
    useSpaceDataSourceViews({
      workspaceId: owner.sId,
      spaceId: space.sId,
      category,
    });
  const sortedViews = useMemo(() => {
    return spaceDataSourceViews.sort((a, b) =>
      getDataSourceNameFromView(a).localeCompare(getDataSourceNameFromView(b))
    );
  }, [spaceDataSourceViews]);

  return (
    <Tree.Item
      isNavigatable
      label={categoryDetails.label}
      collapsed={!isExpanded}
      onItemClick={() => router.push(spaceCategoryPath)}
      isSelected={router.asPath === spaceCategoryPath}
      onChevronClick={() => setIsExpanded(!isExpanded)}
      visual={categoryDetails.icon}
      areActionsFading={false}
      type={
        isSpaceDataSourceViewsLoading || spaceDataSourceViews.length > 0
          ? "node"
          : "leaf"
      }
    >
      {isExpanded && (
        <Tree isLoading={isSpaceDataSourceViewsLoading}>
          {sortedViews.map((ds) => (
            <SpaceDataSourceViewItem
              item={ds}
              key={ds.sId}
              owner={owner}
              space={space}
            />
          ))}
        </Tree>
      )}
    </Tree.Item>
  );
};

const SpaceAppItem = ({
  app,
  owner,
}: {
  app: AppType;
  owner: LightWorkspaceType;
}): ReactElement => {
  const router = useRouter();

  const appPath = `/w/${owner.sId}/spaces/${app.space.sId}/apps/${app.sId}`;

  return (
    <Tree.Item
      isNavigatable
      type="leaf"
      isSelected={
        router.asPath === appPath ||
        router.asPath.includes(appPath + "/") ||
        router.asPath.includes(appPath + "?")
      }
      onItemClick={() => router.push(appPath)}
      label={app.name}
      visual={CommandLineIcon}
      areActionsFading={false}
    />
  );
};

const SpaceAppSubMenu = ({
  owner,
  space,
  category,
}: {
  owner: LightWorkspaceType;
  space: SpaceType;
  category: "apps";
}) => {
  const router = useRouter();

  const spaceCategoryPath = `/w/${owner.sId}/spaces/${space.sId}/categories/${category}`;
  const isAncestorToCurrentPage =
    router.asPath.startsWith(spaceCategoryPath + "/") ||
    router.asPath === spaceCategoryPath;

  // Unfold the space's category if it's an ancestor of the current page.
  const [isExpanded, setIsExpanded] = useState(false);
  useEffect(() => {
    if (isAncestorToCurrentPage) {
      setIsExpanded(isAncestorToCurrentPage);
    }
  }, [isAncestorToCurrentPage]);

  const categoryDetails = DATA_SOURCE_OR_VIEW_SUB_ITEMS[category];

  const { isAppsLoading, apps } = useApps({
    owner,
    space,
  });

  return (
    <Tree.Item
      isNavigatable
      label={categoryDetails.label}
      collapsed={!isExpanded}
      onItemClick={() => router.push(spaceCategoryPath)}
      isSelected={router.asPath === spaceCategoryPath}
      onChevronClick={() => setIsExpanded(!isExpanded)}
      visual={categoryDetails.icon}
      areActionsFading={false}
      type={isAppsLoading || apps.length > 0 ? "node" : "leaf"}
    >
      {isExpanded && (
        <Tree isLoading={isAppsLoading}>
          {sortBy(apps, "name").map((app) => (
            <SpaceAppItem app={app} key={app.sId} owner={owner} />
          ))}
        </Tree>
      )}
    </Tree.Item>
  );
};
