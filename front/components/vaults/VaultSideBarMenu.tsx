import {
  CloudArrowLeftRightIcon,
  CommandLineIcon,
  FolderIcon,
  GlobeAltIcon,
  Item,
  LockIcon,
  PlanetIcon,
  Tree,
} from "@dust-tt/sparkle";
import type {
  DataSourceOrViewInfo,
  LightWorkspaceType,
  VaultType,
} from "@dust-tt/types";
import { DATA_SOURCE_OR_VIEW_CATEGORIES } from "@dust-tt/types";
import { useRouter } from "next/router";
import type { ReactElement } from "react";
import { Fragment, useState } from "react";

import { CONNECTOR_CONFIGURATIONS } from "@app/lib/connector_providers";
import {
  useVaultDataSourceOrViews,
  useVaultInfo,
  useVaults,
} from "@app/lib/swr";

interface VaultSideBarMenuProps {
  owner: LightWorkspaceType;
}

export default function VaultSideBarMenu({ owner }: VaultSideBarMenuProps) {
  const { vaults, isVaultsLoading } = useVaults({ workspaceId: owner.sId });

  if (!vaults || isVaultsLoading) {
    return <></>;
  }

  return (
    <div className="flex flex-col px-3">
      <Item.List>
        {vaults.map((vault) => (
          <Fragment key={`vault-${vault.sId}`}>
            <Item.SectionHeader
              label={vault.kind === "global" ? "SHARED" : vault.name}
              key={vault.sId}
            />
            {vault.kind === "system" ? (
              <SystemVaultMenu />
            ) : (
              <VaultMenuItem owner={owner} vault={vault} />
            )}
          </Fragment>
        ))}
      </Item.List>
    </div>
  );
}

const RootItemIconWrapper = (
  IconComponent: React.ComponentType<React.SVGProps<SVGSVGElement>>
) => {
  return <IconComponent className="text-brand" />;
};

const SubItemIconItemWrapper = (
  IconComponent: React.ComponentType<React.SVGProps<SVGSVGElement>>
) => {
  return <IconComponent className="text-element-700" />;
};

// System vault.

const SystemVaultMenu = () => {
  // TODO(Groups UI) Implement system vault menu.
  return <></>;
};

// Global + regular vaults.

const VaultMenuItem = ({
  owner,
  vault,
}: {
  owner: LightWorkspaceType;
  vault: VaultType;
}) => {
  const router = useRouter();

  const [isExpanded, setIsExpanded] = useState(false);

  const { vaultInfo, isVaultInfoLoading } = useVaultInfo({
    workspaceId: owner.sId,
    vaultId: vault.sId,
    disabled: !isExpanded,
  });

  const vaultPath = `/w/${owner.sId}/data-sources/vaults/${vault.sId}`;

  return (
    <Tree.Item
      label={vault.kind === "global" ? "Company Data" : vault.name}
      collapsed={!isExpanded}
      onItemClick={() => router.push(vaultPath)}
      isSelected={router.asPath === vaultPath}
      onChevronClick={() => setIsExpanded(!isExpanded)}
      visual={
        vault.kind === "global"
          ? RootItemIconWrapper(PlanetIcon)
          : RootItemIconWrapper(LockIcon)
      }
      size="md"
      areActionsFading={false}
    >
      {isExpanded && (
        <Tree isLoading={isVaultInfoLoading}>
          {vaultInfo?.categories &&
            DATA_SOURCE_OR_VIEW_CATEGORIES.map(
              (c) =>
                vaultInfo.categories[c] && (
                  <VaultCategoryItem
                    key={c}
                    category={c}
                    owner={owner}
                    vault={vault}
                  />
                )
            )}
        </Tree>
      )}
    </Tree.Item>
  );
};

const DATA_SOURCE_OR_VIEW_SUB_ITEMS: {
  [key: string]: {
    label: string;
    icon: ReactElement<{
      className?: string;
    }>;
    dataSourceOrView: "data_sources" | "data_source_views";
  };
} = {
  managed: {
    label: "Connected Data",
    icon: SubItemIconItemWrapper(CloudArrowLeftRightIcon),
    dataSourceOrView: "data_source_views",
  },
  files: {
    label: "Files",
    icon: SubItemIconItemWrapper(FolderIcon),
    dataSourceOrView: "data_sources",
  },
  webfolder: {
    label: "Websites",
    icon: SubItemIconItemWrapper(GlobeAltIcon),
    dataSourceOrView: "data_sources",
  },
  apps: {
    label: "Apps",
    icon: SubItemIconItemWrapper(CommandLineIcon),
    dataSourceOrView: "data_sources",
  },
};

const VaultDataSourceOrViewItem = ({
  owner,
  vault,
  item,
}: {
  owner: LightWorkspaceType;
  vault: VaultType;
  item: DataSourceOrViewInfo;
}): ReactElement => {
  const router = useRouter();
  const configuration = item.connectorProvider
    ? CONNECTOR_CONFIGURATIONS[item.connectorProvider]
    : null;

  const LogoComponent = configuration?.logoComponent ?? FolderIcon;
  const label = configuration?.name ?? item.name;
  const viewType =
    DATA_SOURCE_OR_VIEW_SUB_ITEMS[item.category].dataSourceOrView;
  const dataSourceOrViewPath = `/w/${owner.sId}/data-sources/vaults/${vault.sId}/categories/${item.category}/${viewType}/${item.sId}`;

  return (
    <Tree.Item
      type="leaf"
      isSelected={router.asPath === dataSourceOrViewPath}
      onItemClick={() => router.push(dataSourceOrViewPath)}
      label={label}
      visual={SubItemIconItemWrapper(LogoComponent)}
      areActionsFading={false}
    />
  );
};

const VaultCategoryItem = ({
  owner,
  vault,
  category,
}: {
  owner: LightWorkspaceType;
  vault: VaultType;
  category: string;
}) => {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const categoryDetails = DATA_SOURCE_OR_VIEW_SUB_ITEMS[category];
  const { isVaultDataSourceOrViewsLoading, vaultDataSourceOrViews } =
    useVaultDataSourceOrViews({
      workspaceId: owner.sId,
      vaultId: vault.sId,
      category,
      type: categoryDetails.dataSourceOrView,
      disabled: !isExpanded,
    });

  const vaultCategoryPath = `/w/${owner.sId}/data-sources/vaults/${vault.sId}/categories/${category}`;

  return (
    <Tree.Item
      label={categoryDetails.label}
      collapsed={!isExpanded}
      onItemClick={() => router.push(vaultCategoryPath)}
      isSelected={router.asPath === vaultCategoryPath}
      onChevronClick={() => setIsExpanded(!isExpanded)}
      visual={categoryDetails.icon}
      areActionsFading={false}
    >
      {isExpanded && (
        <Tree isLoading={isVaultDataSourceOrViewsLoading}>
          {vaultDataSourceOrViews &&
            vaultDataSourceOrViews.map((ds) => (
              <VaultDataSourceOrViewItem
                key={ds.sId}
                owner={owner}
                vault={vault}
                item={ds}
              />
            ))}
        </Tree>
      )}
    </Tree.Item>
  );
};
