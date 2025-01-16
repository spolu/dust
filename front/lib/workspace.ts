import type {
  LightWorkspaceType,
  ModelId,
  RoleType,
  UserType,
  WorkspaceType,
} from "@dust-tt/types";

import config from "@app/lib/api/config";
import { Workspace } from "@app/lib/models/workspace";
import { UserResource } from "@app/lib/resources/user_resource";

function isADustProdWorkspace(
  workspace: Workspace | WorkspaceType | LightWorkspaceType
) {
  return (
    workspace.sId === config.getDustWorkspaceId() ||
    workspace.sId === config.getDustAppsWorkspaceId()
  );
}

export function renderLightWorkspaceType({
  workspace,
  role = "none",
}: {
  workspace: Workspace | WorkspaceType | LightWorkspaceType;
  role?: RoleType;
}): LightWorkspaceType {
  return {
    id: workspace.id,
    sId: workspace.sId,
    name: workspace.name,
    segmentation: workspace.segmentation,
    whiteListedProviders: workspace.whiteListedProviders,
    defaultEmbeddingProvider: workspace.defaultEmbeddingProvider,
    role,
    isADustWorkspace: isADustProdWorkspace(workspace),
  };
}

// TODO: This belong to the WorkspaceResource.
export async function getWorkspaceFirstAdmin(
  workspace: Workspace
): Promise<UserType | undefined> {
  const user = await UserResource.getWorkspaceFirstAdmin(workspace.id);
  return user?.toJSON();
}

export async function getWorkspaceByModelId(id: ModelId) {
  const workspace = await Workspace.findByPk(id);

  return workspace;
}
