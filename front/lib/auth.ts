import { getSession as getAuth0Session } from "@auth0/nextjs-auth0";
import type {
  ACLType,
  GroupType,
  LightWorkspaceType,
  Permission,
  RoleType,
  UserType,
  WhitelistableFeature,
  WorkspaceType,
} from "@dust-tt/types";
import type { PlanType, SubscriptionType } from "@dust-tt/types";
import type { DustAPICredentials } from "@dust-tt/types";
import type { Result } from "@dust-tt/types";
import type { APIErrorWithStatusCode } from "@dust-tt/types";
import {
  Err,
  groupHasPermission,
  isAdmin,
  isBuilder,
  isDevelopment,
  isUser,
  Ok,
  WHITELISTABLE_FEATURES,
} from "@dust-tt/types";
import * as _ from "lodash";
import type {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from "next";

import type { SessionWithUser } from "@app/lib/iam/provider";
import { isValidSession } from "@app/lib/iam/provider";
import { FeatureFlag } from "@app/lib/models/feature_flag";
import { Plan, Subscription } from "@app/lib/models/plan";
import { Workspace } from "@app/lib/models/workspace";
import type { PlanAttributes } from "@app/lib/plans/free_plans";
import { FREE_NO_PLAN_DATA } from "@app/lib/plans/free_plans";
import { isUpgraded } from "@app/lib/plans/plan_codes";
import { renderSubscriptionFromModels } from "@app/lib/plans/subscription";
import { getTrialVersionForPlan, isTrial } from "@app/lib/plans/trial";
import { GroupResource } from "@app/lib/resources/group_resource";
import type { KeyAuthType } from "@app/lib/resources/key_resource";
import { KeyResource } from "@app/lib/resources/key_resource";
import { MembershipResource } from "@app/lib/resources/membership_resource";
import { UserResource } from "@app/lib/resources/user_resource";
import { renderLightWorkspaceType } from "@app/lib/workspace";
import logger from "@app/logger/logger";

import config from "./api/config";
const { ACTIVATE_ALL_FEATURES_DEV = false } = process.env;

const DUST_INTERNAL_EMAIL_REGEXP = /^[^@]+@dust\.tt$/;

/**
 * This is a class that will be used to check if a user can perform an action on a resource.
 * It acts as a central place to enforce permissioning across all of Dust.
 *
 * It explicitely does not store a reference to the current user to make sure our permissions are
 * workspace oriented. Use `getUserFromSession` if needed.
 */
export class Authenticator {
  _flags: WhitelistableFeature[];
  _key?: KeyAuthType;
  _role: RoleType;
  _subscription: SubscriptionType | null;
  _user: UserResource | null;
  _groups: GroupResource[];
  _workspace: Workspace | null;

  // Should only be called from the static methods below.
  constructor({
    workspace,
    user,
    role,
    groups,
    subscription,
    flags,
    key,
  }: {
    workspace?: Workspace | null;
    user?: UserResource | null;
    role: RoleType;
    groups: GroupResource[];
    subscription?: SubscriptionType | null;
    flags: WhitelistableFeature[];
    key?: KeyAuthType;
  }) {
    this._workspace = workspace || null;
    this._user = user || null;
    this._groups = groups;
    this._role = role;
    this._subscription = subscription || null;
    this._flags = flags;
    this._key = key;
  }

  /**
   * Get a an Authenticator for the target workspace associated with the authentified user from the
   * Auth0 session.
   *
   * @param session any Auth0 session
   * @param wId string target workspace id
   * @returns Promise<Authenticator>
   */
  static async fromSession(
    session: SessionWithUser | null,
    wId: string
  ): Promise<Authenticator> {
    const [workspace, user] = await Promise.all([
      (async () => {
        return Workspace.findOne({
          where: {
            sId: wId,
          },
        });
      })(),
      (async () => {
        if (!session) {
          return null;
        } else {
          return UserResource.fetchByAuth0Sub(session.user.sub);
        }
      })(),
    ]);

    let role = "none" as RoleType;
    let groups: GroupResource[] = [];
    let subscription: SubscriptionType | null = null;
    let flags: WhitelistableFeature[] = [];

    if (user && workspace) {
      [role, groups, subscription, flags] = await Promise.all([
        MembershipResource.getActiveMembershipOfUserInWorkspace({
          user,
          workspace: renderLightWorkspaceType({ workspace }),
        }).then((m) => m?.role ?? "none"),
        GroupResource.listUserGroupsInWorkspace({
          user,
          workspace: renderLightWorkspaceType({ workspace }),
        }),
        subscriptionForWorkspace(renderLightWorkspaceType({ workspace })),
        FeatureFlag.findAll({
          where: {
            workspaceId: workspace.id,
          },
        }).then((flags) => flags.map((flag) => flag.name)),
      ]);
    }

    return new Authenticator({
      workspace,
      user,
      role,
      groups,
      subscription,
      flags,
    });
  }

  /**
   * Get a an Authenticator for the target workspace and the authentified Super User user from the
   * Auth0 session.
   * Super User will have `role` set to `admin` regardless of their actual role in the workspace.
   *
   * @param session any Auth0 session
   * @param wId string target workspace id
   * @returns Promise<Authenticator>
   */
  static async fromSuperUserSession(
    session: SessionWithUser | null,
    wId: string | null
  ): Promise<Authenticator> {
    const [workspace, user] = await Promise.all([
      (async () => {
        if (!wId) {
          return null;
        }
        return Workspace.findOne({
          where: {
            sId: wId,
          },
        });
      })(),
      (async () => {
        if (!session) {
          return null;
        } else {
          return UserResource.fetchByAuth0Sub(session.user.sub);
        }
      })(),
    ]);

    let groups: GroupResource[] = [];
    let subscription: SubscriptionType | null = null;
    let flags: WhitelistableFeature[] = [];

    if (workspace) {
      [groups, subscription, flags] = await Promise.all([
        user?.isDustSuperUser
          ? GroupResource.superAdminFetchWorkspaceGroups(user, workspace.id)
          : [],
        subscriptionForWorkspace(renderLightWorkspaceType({ workspace })),
        (async () => {
          return (
            await FeatureFlag.findAll({
              where: {
                workspaceId: workspace?.id,
              },
            })
          ).map((flag) => flag.name);
        })(),
      ]);
    }

    return new Authenticator({
      workspace,
      user,
      role: user?.isDustSuperUser ? "admin" : "none",
      groups,
      subscription,
      flags,
    });
  }
  /**
   * Get an Authenticator for the target workspace associated with the specified user.
   * To be used only in context where you can't get an authenticator object from a secured key (session or API Key)
   *
   * @param uId number user id
   * @param wId string target workspace sid
   * @returns Promise<Authenticator>
   */
  static async fromUserIdAndWorkspaceId(
    uId: string,
    wId: string
  ): Promise<Authenticator> {
    const [workspace, user] = await Promise.all([
      Workspace.findOne({
        where: {
          sId: wId,
        },
      }),
      UserResource.fetchById(uId),
    ]);

    let role: RoleType = "none";
    let groups: GroupResource[] = [];
    let subscription: SubscriptionType | null = null;
    let flags: WhitelistableFeature[] = [];

    if (user && workspace) {
      [role, groups, subscription, flags] = await Promise.all([
        MembershipResource.getActiveMembershipOfUserInWorkspace({
          user,
          workspace: renderLightWorkspaceType({ workspace }),
        }).then((m) => m?.role ?? "none"),
        GroupResource.listUserGroupsInWorkspace({
          user,
          workspace: renderLightWorkspaceType({ workspace }),
        }),
        subscriptionForWorkspace(renderLightWorkspaceType({ workspace })),
        FeatureFlag.findAll({
          where: {
            workspaceId: workspace.id,
          },
        }).then((flags) => flags.map((flag) => flag.name)),
      ]);
    }

    return new Authenticator({
      workspace,
      user,
      role,
      groups,
      subscription,
      flags,
    });
  }

  /**
   * Returns two Authenticators, one for the workspace associated with the key and one for the
   * workspace provided as an argument.
   *
   * @param key Key the API key
   * @param wId the target workspaceId
   * @returns Promise<{ workspaceAuth: Authenticator, keyAuth: Authenticator }>
   */
  static async fromKey(
    key: KeyResource,
    wId: string,
    requestedGroupIds?: string[]
  ): Promise<{
    workspaceAuth: Authenticator;
    keyAuth: Authenticator;
  }> {
    const [workspace, keyWorkspace] = await Promise.all([
      (async () => {
        return Workspace.findOne({
          where: {
            sId: wId,
          },
        });
      })(),
      (async () => {
        return Workspace.findOne({
          where: {
            id: key.workspaceId,
          },
        });
      })(),
    ]);

    if (!keyWorkspace) {
      throw new Error("Key workspace not found");
    }

    let role = "none" as RoleType;
    const isKeyWorkspace = keyWorkspace.id === workspace?.id;
    if (isKeyWorkspace) {
      role = "builder";
    }

    const getSubscriptionForWorkspace = (workspace: Workspace) =>
      subscriptionForWorkspace(renderLightWorkspaceType({ workspace }));

    const getFeatureFlags = async (workspace: Workspace) =>
      (await FeatureFlag.findAll({ where: { workspaceId: workspace.id } })).map(
        (flag) => flag.name
      );

    let keyGroups: GroupResource[] = [];
    let requestedGroups: GroupResource[] = [];
    let keyFlags: WhitelistableFeature[] = [];
    let workspaceFlags: WhitelistableFeature[] = [];

    let workspaceSubscription: SubscriptionType | null = null;
    let keySubscription: SubscriptionType | null = null;

    if (workspace) {
      [
        keyGroups,
        requestedGroups,
        keySubscription,
        keyFlags,
        workspaceSubscription,
        workspaceFlags,
      ] = await Promise.all([
        // Key related attributes.
        GroupResource.listWorkspaceGroupsFromKey(key),
        requestedGroupIds
          ? GroupResource.listGroupsWithSystemKey(key, requestedGroupIds)
          : [],
        getSubscriptionForWorkspace(keyWorkspace),
        getFeatureFlags(keyWorkspace),
        // Workspace related attributes.
        getSubscriptionForWorkspace(workspace),
        getFeatureFlags(workspace),
      ]);
    }

    const allGroups = Object.entries(
      keyGroups.concat(requestedGroups).reduce(
        (acc, group) => {
          acc[group.id] = group;
          return acc;
        },
        {} as Record<string, GroupResource>
      )
    ).map(([, group]) => group);

    return {
      workspaceAuth: new Authenticator({
        flags: workspaceFlags,
        // If the key is associated with the workspace, we associate the groups.
        groups: isKeyWorkspace ? allGroups : [],
        key: key.toAuthJSON(),
        role,
        subscription: workspaceSubscription,
        workspace,
      }),
      keyAuth: new Authenticator({
        flags: keyFlags,
        groups: allGroups,
        key: key.toAuthJSON(),
        role: "builder",
        subscription: keySubscription,
        workspace: keyWorkspace,
      }),
    };
  }

  /**
   * Creates an Authenticator for a given workspace (with role `builder`). Used for internal calls
   * to the Dust API or other functions, when the system is calling something for the workspace.
   * @param workspaceId string
   */
  static async internalBuilderForWorkspace(
    workspaceId: string
  ): Promise<Authenticator> {
    const workspace = await Workspace.findOne({
      where: {
        sId: workspaceId,
      },
    });
    if (!workspace) {
      throw new Error(`Could not find workspace with sId ${workspaceId}`);
    }

    let globalGroup: GroupResource | null = null;
    let subscription: SubscriptionType | null = null;
    let flags: WhitelistableFeature[] = [];

    // TODO(GROUPS_INFRA): this should be refactored to use the new groups infra.
    [globalGroup, subscription, flags] = await Promise.all([
      GroupResource.internalFetchWorkspaceGlobalGroup(workspace.id),
      subscriptionForWorkspace(renderLightWorkspaceType({ workspace })),
      (async () => {
        return (
          await FeatureFlag.findAll({
            where: {
              workspaceId: workspace?.id,
            },
          })
        ).map((flag) => flag.name);
      })(),
    ]);

    return new Authenticator({
      workspace,
      role: "builder",
      groups: [globalGroup],
      subscription,
      flags,
    });
  }

  /* As above, with role `admin` */
  static async internalAdminForWorkspace(
    workspaceId: string
  ): Promise<Authenticator> {
    const workspace = await Workspace.findOne({
      where: {
        sId: workspaceId,
      },
    });
    if (!workspace) {
      throw new Error(`Could not find workspace with sId ${workspaceId}`);
    }

    let globalGroup: GroupResource | null = null;
    let subscription: SubscriptionType | null = null;
    let flags: WhitelistableFeature[] = [];

    // TODO(GROUPS_INFRA): maybe this group should access not only to the global group
    // but all groups? To be answered while moving forward with this new infra.
    [globalGroup, subscription, flags] = await Promise.all([
      GroupResource.internalFetchWorkspaceGlobalGroup(workspace.id),
      subscriptionForWorkspace(renderLightWorkspaceType({ workspace })),
      (async () => {
        return (
          await FeatureFlag.findAll({
            where: {
              workspaceId: workspace?.id,
            },
          })
        ).map((flag) => flag.name);
      })(),
    ]);

    return new Authenticator({
      workspace,
      role: "admin",
      groups: [globalGroup],
      subscription,
      flags,
    });
  }

  /**
   * Exchanges an Authenticator associated with a system key for one associated with a user.
   *
   * /!\ This function should only be used with Authenticators that are associated with a system key.
   *
   * @param auth
   * @param param1
   * @returns
   */
  // TODO(2024-08-05 flav) Use user-id instead of email to avoid ambiguity.
  async exchangeSystemKeyForUserAuthByEmail(
    auth: Authenticator,
    { userEmail }: { userEmail: string }
  ): Promise<Authenticator | null> {
    if (!auth.isSystemKey()) {
      throw new Error("Provided authenticator does not have a system key.");
    }

    const owner = auth.workspace();
    if (!owner) {
      throw new Error("Workspace not found.");
    }

    // The same email address might be linked to multiple users.
    const users = await UserResource.listByEmail(userEmail);
    // If no user exist (e.g., whitelisted email addresses),
    // simply ignore and return null.
    if (users.length === 0) {
      return null;
    }

    // Verify that one of the user has an active membership in the specified workspace.
    const activeMemberships = await MembershipResource.getActiveMemberships({
      users,
      workspace: owner,
    });
    // If none of the user has an active membership in the workspace,
    // simply ignore and return null.
    if (activeMemberships.length === 0) {
      return null;
    }

    // Take the oldest active membership.
    const [activeMembership] = activeMemberships.sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
    // Find the user associated with the active membership.
    const user = users.find((u) => u.id === activeMembership.userId);
    if (!user) {
      return null;
    }

    const groups = await GroupResource.listUserGroupsInWorkspace({
      user,
      workspace: renderLightWorkspaceType({ workspace: owner }),
    });

    return new Authenticator({
      flags: auth._flags,
      key: auth._key,
      // We limit scope to a user role.
      role: "user",
      groups,
      user,
      subscription: auth._subscription,
      workspace: auth._workspace,
    });
  }

  role(): RoleType {
    return this._role;
  }

  isUser(): boolean {
    return isUser(this.workspace());
  }

  isBuilder(): boolean {
    return isBuilder(this.workspace());
  }

  isAdmin(): boolean {
    return isAdmin(this.workspace());
  }

  isSystemKey(): boolean {
    return !!this._key?.isSystem;
  }

  workspace(): WorkspaceType | null {
    return this._workspace
      ? {
          id: this._workspace.id,
          sId: this._workspace.sId,
          name: this._workspace.name,
          role: this._role,
          segmentation: this._workspace.segmentation || null,
          flags:
            typeof ACTIVATE_ALL_FEATURES_DEV === "string" && isDevelopment()
              ? [...WHITELISTABLE_FEATURES]
              : this._flags,
          ssoEnforced: this._workspace.ssoEnforced,
          whiteListedProviders: this._workspace.whiteListedProviders,
          defaultEmbeddingProvider: this._workspace.defaultEmbeddingProvider,
        }
      : null;
  }

  getNonNullableWorkspace(): WorkspaceType {
    const workspace = this.workspace();

    if (!workspace) {
      throw new Error(
        "Unexpected unauthenticated call to `getNonNullableWorkspace`."
      );
    }

    return workspace;
  }

  subscription(): SubscriptionType | null {
    return this._subscription;
  }

  getNonNullableSubscription(): SubscriptionType {
    const subscription = this.subscription();

    if (!subscription) {
      throw new Error(
        "Unexpected unauthenticated call to `getNonNullableSubscription`."
      );
    }

    return subscription;
  }

  plan(): PlanType | null {
    return this._subscription ? this._subscription.plan : null;
  }

  getNonNullablePlan(): PlanType {
    const plan = this.plan();

    if (!plan) {
      throw new Error(
        "Unexpected unauthenticated call to `getNonNullablePlan`."
      );
    }

    return plan;
  }

  isUpgraded(): boolean {
    return isUpgraded(this.plan());
  }

  /**
   * This is a convenience method to get the user from the Authenticator. The returned UserType
   * object won't have the user's workspaces set.
   * @returns
   */
  user(): UserType | null {
    return this._user ? this._user.toJSON() : null;
  }

  getNonNullableUser(): UserType {
    const user = this.user();

    if (!user) {
      throw new Error(
        "Unexpected unauthenticated call to `getNonNullableUser`."
      );
    }

    return user;
  }

  isDustSuperUser(): boolean {
    if (!this._user) {
      return false;
    }

    const { email, isDustSuperUser = false } = this._user;
    const isDustInternal =
      isDevelopment() || DUST_INTERNAL_EMAIL_REGEXP.test(email);

    return isDustInternal && isDustSuperUser;
  }

  groups(): GroupType[] {
    return this._groups.map((g) => g.toJSON());
  }

  hasPermission(acls: ACLType[], permission: Permission): boolean {
    // Does the user belongs to a group which has the required permission on all ACLs ?
    return this.groups().some((group) =>
      acls.every((acl) => groupHasPermission(acl, permission, group.id))
    );
  }

  canRead(acls: ACLType[]): boolean {
    return this.hasPermission(acls, "read");
  }

  canWrite(acls: ACLType[]): boolean {
    return this.hasPermission(acls, "write");
  }
}

/**
 * Retrieves the Auth0 session from the request/response.
 * @param req NextApiRequest request object
 * @param res NextApiResponse response object
 * @returns Promise<any>
 */
export async function getSession(
  req: NextApiRequest | GetServerSidePropsContext["req"],
  res: NextApiResponse | GetServerSidePropsContext["res"]
): Promise<SessionWithUser | null> {
  const session = await getAuth0Session(req, res);
  if (!session || !isValidSession(session)) {
    return null;
  }

  return session;
}

/**
 * Retrieves the API Key from the request.
 * @param req NextApiRequest request object
 * @returns Result<Key, APIErrorWithStatusCode>
 */
export async function getAPIKey(
  req: NextApiRequest
): Promise<Result<KeyResource, APIErrorWithStatusCode>> {
  if (!req.headers.authorization) {
    return new Err({
      status_code: 401,
      api_error: {
        type: "missing_authorization_header_error",
        message: "Missing Authorization header",
      },
    });
  }

  const parse = req.headers.authorization.match(/Bearer (sk-[a-zA-Z0-9]+)/);
  if (!parse || !parse[1] || !parse[1].startsWith("sk-")) {
    return new Err({
      status_code: 401,
      api_error: {
        type: "malformed_authorization_header_error",
        message: "Malformed Authorization header",
      },
    });
  }

  const key = await KeyResource.fetchBySecret(parse[1]);

  if (!key || !key.isActive) {
    return new Err({
      status_code: 401,
      api_error: {
        type: "invalid_api_key_error",
        message: "The API key provided is invalid or disabled.",
      },
    });
  }

  if (!key.isSystem) {
    await key.markAsUsed();
  }

  return new Ok(key);
}

/**
 * Construct the SubscriptionType for the provided workspace.
 * @param w WorkspaceType the workspace to get the plan for
 * @returns SubscriptionType
 */
export async function subscriptionForWorkspace(
  workspace: LightWorkspaceType
): Promise<SubscriptionType> {
  const res = await subscriptionForWorkspaces([workspace]);

  const subscription = workspace.sId in res ? res[workspace.sId] : null;
  if (!subscription) {
    throw new Error(
      `Could not find subscription for workspace ${workspace.sId}`
    );
  }

  return subscription;
}

/**
 * Construct the SubscriptionType for the provided workspaces.
 * @param w WorkspaceType the workspace to get the plan for
 * @returns SubscriptionType
 */
export async function subscriptionForWorkspaces(
  workspaces: LightWorkspaceType[]
): Promise<{ [key: string]: SubscriptionType }> {
  const workspaceModelBySid = _.keyBy(workspaces, "sId");

  const activeSubscriptionByWorkspaceId = _.keyBy(
    await Subscription.findAll({
      attributes: [
        "endDate",
        "id",
        "paymentFailingSince",
        "sId",
        "startDate",
        "status",
        "stripeSubscriptionId",
        "trialing",
        "workspaceId",
      ],
      where: {
        workspaceId: Object.values(workspaceModelBySid).map((w) => w.id),
        status: "active",
      },
      include: [
        {
          model: Plan,
          as: "plan",
          required: true,
        },
      ],
    }),
    "workspaceId"
  );

  const renderedSubscriptionByWorkspaceSid: Record<string, SubscriptionType> =
    {};

  for (const [sId, workspace] of Object.entries(workspaceModelBySid)) {
    const activeSubscription =
      workspace.id.toString() in activeSubscriptionByWorkspaceId
        ? activeSubscriptionByWorkspaceId[workspace.id.toString()]
        : null;

    // Default values when no subscription
    let plan: PlanAttributes = FREE_NO_PLAN_DATA;

    if (activeSubscription) {
      // If the subscription is in trial, temporarily override the plan until the FREE_TEST_PLAN is phased out.
      if (isTrial(activeSubscription)) {
        plan = getTrialVersionForPlan(activeSubscription.plan);
      } else {
        plan = activeSubscription.plan;
      }
    }

    renderedSubscriptionByWorkspaceSid[sId] = renderSubscriptionFromModels({
      plan,
      activeSubscription,
    });
  }

  return renderedSubscriptionByWorkspaceSid;
}

/**
 * Retrieves or create a system API key for a given workspace
 * @param workspace WorkspaceType
 * @returns Promise<Result<KeyResource, Error>>
 */
export async function getOrCreateSystemApiKey(
  workspace: LightWorkspaceType
): Promise<Result<KeyResource, Error>> {
  let key = await KeyResource.fetchSystemKeyForWorkspace(workspace);

  if (!key) {
    const group = await GroupResource.internalFetchWorkspaceSystemGroup(
      workspace.id
    );
    key = await KeyResource.makeNew(
      {
        workspaceId: workspace.id,
        isSystem: true,
        status: "active",
      },
      group
    );
  }

  return new Ok(key);
}

/**
 * Retrieves a system API key for the given owner, creating one if needed.
 *
 * In development mode, we retrieve the system API key from the environment variable
 * `DUST_DEVELOPMENT_SYSTEM_API_KEY`, so that we always use our own `dust` workspace in production
 * to iterate on the design of the packaged apps. When that's the case, the `owner` paramater (which
 * is local) is ignored.
 *
 * @param owner WorkspaceType
 * @returns DustAPICredentials
 */
export async function prodAPICredentialsForOwner(
  owner: LightWorkspaceType,
  {
    useLocalInDev,
  }: {
    useLocalInDev: boolean;
  } = { useLocalInDev: false }
): Promise<DustAPICredentials> {
  if (
    isDevelopment() &&
    !config.getDustAPIConfig().url.startsWith("http://localhost") &&
    !useLocalInDev
  ) {
    return {
      apiKey: config.getDustDevelopmentSystemAPIKey(),
      workspaceId: config.getDustDevelopmentWorkspaceId(),
    };
  }

  const systemAPIKeyRes = await getOrCreateSystemApiKey(owner);
  if (systemAPIKeyRes.isErr()) {
    logger.error(
      {
        owner,
        error: systemAPIKeyRes.error,
      },
      "Could not create system API key for workspace"
    );
    throw new Error(`Could not create system API key for workspace`);
  }

  return {
    apiKey: systemAPIKeyRes.value.secret,
    workspaceId: owner.sId,
  };
}
