import type { Session } from "@auth0/nextjs-auth0";
import type { Result, UserProviderType } from "@dust-tt/types";
import { Err, Ok, sanitizeString } from "@dust-tt/types";
import type { PostIdentitiesRequestProviderEnum } from "auth0";

import { getAuth0ManagemementClient } from "@app/lib/api/auth0";
import type { ExternalUser, SessionWithUser } from "@app/lib/iam/provider";
import { UserModel } from "@app/lib/resources/storage/models/user";
import { generateRandomModelSId } from "@app/lib/resources/string_ids";
import { UserResource } from "@app/lib/resources/user_resource";
import { ServerSideTracking } from "@app/lib/tracking/server";
import { guessFirstAndLastNameFromFullName } from "@app/lib/user";

interface LegacyProviderInfo {
  provider: UserProviderType;
  providerId: number | string;
}

async function fetchUserWithLegacyProvider(
  { provider, providerId }: LegacyProviderInfo,
  sub: string
) {
  const user = await UserResource.fetchByProvider(
    provider,
    providerId.toString()
  );

  // If a legacy user is found, attach the Auth0 user ID (sub) to the existing user account.
  if (user) {
    await user.updateAuth0Sub(sub);
  }

  return user;
}

export async function fetchUserWithAuth0Sub(sub: string) {
  const userWithAuth0 = await UserResource.fetchByAuth0Sub(sub);

  return userWithAuth0;
}

function mapAuth0ProviderToLegacy(session: Session): LegacyProviderInfo | null {
  const { user } = session;

  const [rawProvider, providerId] = user.sub.split("|");
  switch (rawProvider) {
    case "google-oauth2":
      return { provider: "google", providerId };

    case "github":
      return { provider: "github", providerId };

    default:
      return { provider: rawProvider, providerId };
  }
}

export async function fetchUserFromSession(session: SessionWithUser) {
  const { sub } = session.user;

  const userWithAuth0 = await fetchUserWithAuth0Sub(sub);
  if (userWithAuth0) {
    return userWithAuth0;
  }

  const legacyProviderInfo = mapAuth0ProviderToLegacy(session);
  if (!legacyProviderInfo) {
    return null;
  }

  return fetchUserWithLegacyProvider(legacyProviderInfo, sub);
}

export async function maybeUpdateFromExternalUser(
  user: UserResource,
  externalUser: ExternalUser
) {
  if (externalUser.picture && externalUser.picture !== user.imageUrl) {
    void UserModel.update(
      {
        imageUrl: externalUser.picture,
      },
      {
        where: {
          id: user.id,
        },
      }
    );
  }
}

export async function createOrUpdateUser(
  session: SessionWithUser
): Promise<{ user: UserResource; created: boolean }> {
  const { user: externalUser } = session;

  const user = await fetchUserFromSession(session);

  if (user) {
    const updateArgs: { [key: string]: string } = {};

    // We only update the user's email if the email is verified.
    if (externalUser.email_verified) {
      updateArgs.email = externalUser.email;
    }

    // Update the user object from the updated session information.
    updateArgs.username = externalUser.nickname;

    if (!user.firstName && !user.lastName) {
      if (externalUser.given_name && externalUser.family_name) {
        updateArgs.firstName = externalUser.given_name;
        updateArgs.lastName = externalUser.family_name;
      } else {
        const { firstName, lastName } = guessFirstAndLastNameFromFullName(
          externalUser.name
        );
        updateArgs.firstName = firstName;
        updateArgs.lastName = lastName || "";
      }
    }

    if (Object.keys(updateArgs).length > 0) {
      const needsUpdate = Object.entries(updateArgs).some(
        ([key, value]) => user[key as keyof typeof user] !== value
      );

      if (needsUpdate) {
        await user.updateInfo(
          updateArgs.username || user.name,
          updateArgs.firstName || user.firstName,
          updateArgs.lastName || user.lastName,
          updateArgs.email || user.email
        );
      }
    }

    return { user, created: false };
  } else {
    const { firstName, lastName } = guessFirstAndLastNameFromFullName(
      externalUser.name
    );

    const u = await UserResource.makeNew({
      sId: generateRandomModelSId(),
      auth0Sub: externalUser.sub,
      provider: mapAuth0ProviderToLegacy(session)?.provider ?? null,
      username: externalUser.nickname,
      email: sanitizeString(externalUser.email),
      name: externalUser.name,
      firstName: externalUser.given_name ?? firstName,
      lastName: externalUser.family_name ?? lastName,
    });

    ServerSideTracking.trackSignup({
      user: {
        sId: u.sId,
        id: u.id,
        createdAt: u.createdAt.getTime(),
        provider: u.provider,
        username: u.username,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        image: u.imageUrl,
        fullName: u.name,
      },
    });

    return { user: u, created: true };
  }
}

export async function mergeUserIdentities({
  primaryUserId,
  secondaryUserId,
}: {
  primaryUserId: string;
  secondaryUserId: string;
}): Promise<
  Result<{ primaryUser: UserResource; secondaryUser: UserResource }, Error>
> {
  if (primaryUserId === secondaryUserId) {
    return new Err(new Error("Primary and secondary user IDs are the same."));
  }

  const primaryUser = await UserResource.fetchById(primaryUserId);
  const secondaryUser = await UserResource.fetchById(secondaryUserId);
  if (!primaryUser || !secondaryUser) {
    return new Err(new Error("Primary or secondary user not found."));
  }

  if (primaryUser.email !== secondaryUser.email) {
    return new Err(
      new Error("Primary and secondary user emails do not match.")
    );
  }

  const auth0ManagemementClient = getAuth0ManagemementClient();

  const users = await auth0ManagemementClient.usersByEmail.getByEmail({
    email: primaryUser.email.toLowerCase(),
  });

  const primaryUserAuth0 = users.data.find(
    (u) => u.user_id === primaryUser.auth0Sub
  );
  const secondaryUserAuth0 = users.data.find(
    (u) => u.user_id === secondaryUser.auth0Sub
  );

  if (!primaryUserAuth0 || !secondaryUserAuth0) {
    return new Err(new Error("Primary or secondary user not found in Auth0."));
  }

  const [identityToMerge] = secondaryUserAuth0.identities;

  // Retrieve the connection id for the identity to merge.
  const connectionsResponse =
    await getAuth0ManagemementClient().connections.getAll({
      name: identityToMerge.connection,
    });

  const [connection] = connectionsResponse.data;
  if (!connection) {
    return new Err(
      new Error(`Auth0 connection ${identityToMerge.connection} not found.`)
    );
  }

  await auth0ManagemementClient.users.link(
    { id: primaryUserAuth0.user_id },
    {
      provider: identityToMerge.provider as PostIdentitiesRequestProviderEnum,
      connection_id: connection.id,
      user_id: identityToMerge.user_id,
    }
  );

  // Mark the primary user as having been linked.
  await auth0ManagemementClient.users.update(
    { id: primaryUserAuth0.user_id },
    {
      app_metadata: {
        account_linking_state: Date.now(),
      },
    }
  );

  return new Ok({
    primaryUser,
    secondaryUser,
  });
}
