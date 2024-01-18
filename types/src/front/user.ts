import { ModelId } from "../shared/model_id";
import { assertNever } from "../shared/utils/assert_never";

export type WorkspaceSegmentationType = "interesting" | null;
export type RoleType = "admin" | "builder" | "user" | "none";

export type WorkspaceType = {
  id: ModelId;
  sId: string;
  name: string;
  allowedDomain: string | null;
  role: RoleType;
  segmentation: WorkspaceSegmentationType;
};

export type UserProviderType = "github" | "google";

export type UserType = {
  id: ModelId;
  provider: UserProviderType;
  providerId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  image: string | null;
  workspaces: WorkspaceType[];
};

export type UserMetadataType = {
  key: string;
  value: string;
};

export function formatUserFullName(user?: {
  firstName?: string;
  lastName?: string | null;
}) {
  return user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ")
    : null;
}

export function isAdmin(owner: WorkspaceType | null) {
  if (!owner) {
    return false;
  }
  switch (owner.role) {
    case "admin":
      return true;
    case "builder":
    case "user":
    case "none":
      return false;
    default:
      assertNever(owner.role);
  }
}

export function isBuilder(owner: WorkspaceType | null) {
  if (!owner) {
    return false;
  }
  switch (owner.role) {
    case "admin":
    case "builder":
      return true;
    case "user":
    case "none":
      return false;
    default:
      assertNever(owner.role);
  }
}

export function isUser(owner: WorkspaceType | null) {
  if (!owner) {
    return false;
  }
  switch (owner.role) {
    case "admin":
    case "builder":
    case "user":
      return true;
    case "none":
      return false;
    default:
      assertNever(owner.role);
  }
}

export function isOnlyUser(owner: WorkspaceType | null) {
  if (!owner) {
    return false;
  }
  switch (owner.role) {
    case "user":
      return true;
    case "builder":
    case "admin":
    case "none":
      return false;
    default:
      assertNever(owner.role);
  }
}
