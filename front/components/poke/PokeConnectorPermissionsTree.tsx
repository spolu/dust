import type {
  ConnectorPermission,
  DataSourceType,
  WorkspaceType,
} from "@dust-tt/types";

import { PermissionTreeChildren } from "@app/components/ConnectorPermissionsTree";
import { usePokeConnectorPermissions } from "@app/lib/swr";

export function PokePermissionTree({
  owner,
  dataSource,
  permissionFilter,
  canUpdatePermissions,
  onPermissionUpdate,
  showExpand,
  displaySource,
}: {
  owner: WorkspaceType;
  dataSource: DataSourceType;
  permissionFilter?: ConnectorPermission;
  canUpdatePermissions?: boolean;
  onPermissionUpdate?: ({
    internalId,
    permission,
  }: {
    internalId: string;
    permission: ConnectorPermission;
  }) => void;
  showExpand?: boolean;
  displaySource: (documentId: string) => void;
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <PermissionTreeChildren
          owner={owner}
          dataSource={dataSource}
          parentId={null}
          permissionFilter={permissionFilter}
          canUpdatePermissions={canUpdatePermissions}
          onPermissionUpdate={onPermissionUpdate}
          showExpand={showExpand}
          parentIsSelected={false}
          displaySource={displaySource}
          useConnectorPermissionsHook={usePokeConnectorPermissions}
        />
      </div>
    </>
  );
}
