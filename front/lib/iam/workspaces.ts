import type { ExternalUser } from "@app/lib/iam/auth0";
import type { Membership } from "@app/lib/models";
import { Workspace, WorkspaceHasDomain } from "@app/lib/models";
import { generateModelSId } from "@app/lib/utils";
import { isDisposableEmailDomain } from "@app/lib/utils/disposable_email_domains";

export async function createWorkspace(externalUser: ExternalUser) {
  const [, emailDomain] = externalUser.email.split("@");

  // Use domain only when email is verified and non-disposable.
  const verifiedDomain =
    externalUser.email_verified && !isDisposableEmailDomain(emailDomain)
      ? emailDomain
      : null;

  const workspace = await Workspace.create({
    sId: generateModelSId(),
    name: externalUser.nickname ?? externalUser.name,
  });

  if (verifiedDomain) {
    try {
      await WorkspaceHasDomain.create({
        domain: verifiedDomain,
        domainAutoJoinEnabled: false,
        workspaceId: workspace.id,
      });
    } catch (err) {
      // TODO(2024-03-01 flav) Add a log.
      // `WorkspaceHasDomain` table has a unique constraint on the domain column.
      // Suppress any creation errors to prevent disruption of the login process.
    }
  }

  return workspace;
}

export async function findWorkspaceWithVerifiedDomain(
  externalUser: ExternalUser
): Promise<WorkspaceHasDomain | null> {
  // If the user's email is not verified, return null without checking for an existing workspace.
  if (!externalUser.email_verified) {
    return null;
  }

  const [, userEmailDomain] = externalUser.email.split("@");
  const workspaceWithVerifiedDomain = await WorkspaceHasDomain.findOne({
    where: {
      domain: userEmailDomain,
    },
    include: [
      {
        model: Workspace,
        as: "workspace",
        required: true,
      },
    ],
  });

  return workspaceWithVerifiedDomain;
}
