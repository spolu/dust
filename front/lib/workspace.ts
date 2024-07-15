import type {
  LightWorkspaceType,
  RoleType,
  WorkspaceType,
} from "@dust-tt/types";

import type { Workspace } from "@app/lib/models/workspace";
import { UserResource } from "@app/lib/resources/user_resource";

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
  };
}

// TODO: This belong to the WorkspaceResource.
export async function getWorkspaceFirstAdmin(workspace: Workspace) {
  const userRes = await UserResource.getWorkspaceFirstAdmin(workspace.id);
  return userRes?.toJSON();
}
