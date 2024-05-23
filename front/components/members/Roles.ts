import type { ActiveRoleType, RoleType } from "@dust-tt/types";

export function displayRole(role: RoleType): string {
  return role === "user" ? "member" : role;
}

export const ROLES_DATA: Record<
  ActiveRoleType,
  { description: string; color: "red" | "amber" | "emerald" | "slate" }
> = {
  admin: {
    description: "Admins can manage members, in addition to builders' rights.",
    color: "red",
  },
  builder: {
    description:
      "Builders can create custom assistants and use advanced dev tools.",
    color: "amber",
  },
  user: {
    description:
      "Members can use assistants provided by Dust as well as custom assistants created by their company.",
    color: "emerald",
  },
};
