import { RoleType } from "@app/lib/auth";
import { ModelId } from "@app/lib/models";

/**
 *  Expresses limits for usage of the product Any positive number enforces the limit, -1 means no
 *  limit. If the limit is undefined we revert to the default limit.
 * */
export type LimitsType = {
  dataSources: {
    count: number;
    documents: { count: number; sizeMb: number };
    managed: boolean;
  };
};

export type PlanType = {
  limits: LimitsType;
};

export type WorkspaceType = {
  id: ModelId;
  uId: string;
  sId: string;
  name: string;
  allowedDomain: string | null;
  role: RoleType;
  plan: PlanType;
  disableLabs?: boolean;
};

export type UserType = {
  id: ModelId;
  provider: "github" | "google";
  providerId: string;
  username: string;
  email: string;
  name: string;
  image: string | null;
  workspaces: WorkspaceType[];
};

export type UserMetadataType = {
  key: string;
  value: string;
};
