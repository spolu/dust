import {
  Avatar,
  Button,
  ChevronDownIcon,
  Chip,
  ContentMessage,
  Dialog,
  DropdownMenu,
  ElementModal,
  IconButton,
  Modal,
  Page,
  PlusIcon,
  Popup,
  Searchbar,
  TextArea,
} from "@dust-tt/sparkle";
import type { MembershipInvitationType } from "@dust-tt/types";
import type { PlanType, SubscriptionType } from "@dust-tt/types";
import type {
  ActiveRoleType,
  RoleType,
  UserType,
  UserTypeWithWorkspaces,
  WorkspaceDomain,
  WorkspaceType,
} from "@dust-tt/types";
import { ACTIVE_ROLES } from "@dust-tt/types";
import { UsersIcon } from "@heroicons/react/20/solid";
import assert from "assert";
import type { InferGetServerSidePropsType } from "next";
import { useRouter } from "next/router";
import { useContext, useMemo, useState } from "react";
import { useSWRConfig } from "swr";

import type { WorkspaceLimit } from "@app/components/app/ReachedLimitPopup";
import { ReachedLimitPopup } from "@app/components/app/ReachedLimitPopup";
import type { ConfirmDataType } from "@app/components/Confirm";
import { ConfirmContext } from "@app/components/Confirm";
import {RenderInvitations} from "@app/components/members/RenderInvitations";
import {RenderMembers} from "@app/components/members/RenderMembers"
import {displayRole, ROLES_DATA} from "@app/components/members/Roles";
import AppLayout from "@app/components/sparkle/AppLayout";
import { subNavigationAdmin } from "@app/components/sparkle/navigation";
import type { NotificationType } from "@app/components/sparkle/Notification";
import { SendNotificationsContext } from "@app/components/sparkle/Notification";
import type { EnterpriseConnectionStrategyDetails } from "@app/components/workspace/connection";
import { EnterpriseConnectionDetails } from "@app/components/workspace/connection";
import config from "@app/lib/api/config";
import { makeEnterpriseConnectionInitiateLoginUrl } from "@app/lib/api/enterprise_connection";
import {
  checkWorkspaceSeatAvailabilityUsingAuth,
  getWorkspaceVerifiedDomain,
} from "@app/lib/api/workspace";
import {
  getPriceWithCurrency,
  PRO_PLAN_29_COST,
} from "@app/lib/client/subscription";
import { withDefaultUserAuthRequirements } from "@app/lib/iam/session";
import { MAX_UNCONSUMED_INVITATIONS_PER_WORKSPACE_PER_DAY } from "@app/lib/invitations";
import { isProPlanCode, isUpgraded } from "@app/lib/plans/plan_codes";
import { useMembers, useWorkspaceInvitations } from "@app/lib/swr";
import { isEmailValid } from "@app/lib/utils";
import type {
  PostInvitationRequestBody,
  PostInvitationResponseBody,
} from "@app/pages/api/w/[wId]/invitations";

const { GA_TRACKING_ID = "" } = process.env;

export const getServerSideProps = withDefaultUserAuthRequirements<{
  user: UserType;
  owner: WorkspaceType;
  subscription: SubscriptionType;
  enterpriseConnectionStrategyDetails: EnterpriseConnectionStrategyDetails;
  plan: PlanType;
  gaTrackingId: string;
  workspaceHasAvailableSeats: boolean;
  workspaceVerifiedDomain: WorkspaceDomain | null;
}>(async (context, auth) => {
  const plan = auth.plan();
  const owner = auth.workspace();
  const user = auth.user();
  const subscription = auth.subscription();

  if (!owner || !user || !auth.isAdmin() || !plan || !subscription) {
    return {
      notFound: true,
    };
  }

  const workspaceVerifiedDomain = await getWorkspaceVerifiedDomain(owner);
  const workspaceHasAvailableSeats =
    await checkWorkspaceSeatAvailabilityUsingAuth(auth);

  const enterpriseConnectionStrategyDetails: EnterpriseConnectionStrategyDetails =
    {
      callbackUrl: config.getAuth0TenantUrl(),
      initiateLoginUrl: makeEnterpriseConnectionInitiateLoginUrl(owner.sId),
      strategy: "okta",
    };

  return {
    props: {
      user,
      owner,
      subscription,
      enterpriseConnectionStrategyDetails,
      plan,
      gaTrackingId: GA_TRACKING_ID,
      workspaceHasAvailableSeats,
      workspaceVerifiedDomain,
    },
  };
});

export default function WorkspaceAdmin({
  user,
  owner,
  subscription,
  enterpriseConnectionStrategyDetails,
  plan,
  gaTrackingId,
  workspaceVerifiedDomain,
  workspaceHasAvailableSeats,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const [showNoInviteLinkPopup, setShowNoInviteLinkPopup] = useState(false);
  const [isActivateAutoJoinOpened, setIsActivateAutoJoinOpened] =
    useState(false);

  const sendNotification = useContext(SendNotificationsContext);
  const confirm = useContext(ConfirmContext);
  const { mutate } = useSWRConfig();

  const { domain = "", domainAutoJoinEnabled = false } =
    workspaceVerifiedDomain ?? {};

  return (
    <AppLayout
      subscription={subscription}
      owner={owner}
      gaTrackingId={gaTrackingId}
      topNavigationCurrent="admin"
      subNavigation={subNavigationAdmin({ owner, current: "members" })}
    >
      <Page.Vertical gap="xl" align="stretch">
        <Page.Header
          title="Member Management"
          icon={UsersIcon}
          description="Invite and remove members, manage their rights."
        />
        <DomainAutoJoinModal
          domainAutoJoinEnabled={domainAutoJoinEnabled}
          isOpen={isActivateAutoJoinOpened}
          onClose={() => {
            setIsActivateAutoJoinOpened(false);
          }}
          domain={domain}
          owner={owner}
        />
        {workspaceVerifiedDomain && (
          <Page.Vertical gap="sm">
            <Page.H variant="h5">Auto-join Workspace</Page.H>
            <Page.P variant="secondary">
              Allow all your team members to access your Dust company Workspace
              when they authenticate with a{" "}
              <span className="font-bold">"@{domain}"</span> Google accounts.
            </Page.P>
            <div className="flex flex-col items-start gap-3">
              {domainAutoJoinEnabled ? (
                <Button
                  label="De-activate Auto-join"
                  size="sm"
                  variant="secondaryWarning"
                  disabled={!domainAutoJoinEnabled}
                  onClick={() => {
                    if (!isUpgraded(plan)) {
                      setShowNoInviteLinkPopup(true);
                    } else {
                      setIsActivateAutoJoinOpened(true);
                    }
                  }}
                />
              ) : (
                <Button
                  label="Activate Auto-join"
                  size="sm"
                  variant="primary"
                  disabled={domainAutoJoinEnabled}
                  onClick={() => {
                    if (!isUpgraded(plan)) {
                      setShowNoInviteLinkPopup(true);
                    } else {
                      setIsActivateAutoJoinOpened(true);
                    }
                  }}
                />
              )}
              <Popup
                show={showNoInviteLinkPopup}
                chipLabel="Free plan"
                description="You cannot enable auto-join with the free plan. Upgrade your plan to invite other members."
                buttonLabel="Check Dust plans"
                buttonClick={() => {
                  void router.push(`/w/${owner.sId}/subscription`);
                }}
                className="absolute bottom-8 right-0"
                onClose={() => setShowNoInviteLinkPopup(false)}
              />
            </div>
          </Page.Vertical>
        )}
        <EnterpriseConnectionDetails
          owner={owner}
          plan={plan}
          strategyDetails={enterpriseConnectionStrategyDetails}
        />
        <MemberList />
      </Page.Vertical>
    </AppLayout>
  );

  function MemberList() {
    const [inviteBlockedPopupReason, setInviteBlockedPopupReason] =
      useState<WorkspaceLimit | null>(null);

    const [searchText, setSearchText] = useState("");
    const { members, isMembersLoading } = useMembers(owner);
    console.log(searchText);
    const { invitations, isInvitationsLoading } =
      useWorkspaceInvitations(owner);
    const [inviteEmailModalOpen, setInviteEmailModalOpen] = useState(false);

    const [changeRoleMember, setChangeRoleMember] =
      useState<UserTypeWithWorkspaces | null>(null);

    const popup = useMemo(() => {
      if (!inviteBlockedPopupReason) {
        return <></>;
      }

      return (
        <ReachedLimitPopup
          isOpened={!!inviteBlockedPopupReason}
          onClose={() => setInviteBlockedPopupReason(null)}
          subscription={subscription}
          owner={owner}
          code={inviteBlockedPopupReason}
        />
      );
    }, [inviteBlockedPopupReason, setInviteBlockedPopupReason]);
    return (
      <>
        <InviteEmailModal
          showModal={inviteEmailModalOpen}
          onClose={() => {
            setInviteEmailModalOpen(false);
          }}
          owner={owner}
          members={members}
          plan={plan}
        />
        <ChangeMemberModal
          owner={owner}
          member={changeRoleMember}
          onClose={() => setChangeRoleMember(null)}
        />
        <Page.Vertical gap="sm" align="stretch">
          <Page.H variant="h5">Member list</Page.H>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row">
            <div className="flex-grow">
              <Searchbar
                placeholder="Search members"
                onChange={setSearchText}
                value={searchText}
                name={""}
              />
            </div>
            <div className="relative flex-none">
              <Button
                variant="primary"
                label="Invite members"
                size="sm"
                icon={PlusIcon}
                onClick={() => {
                  if (!isUpgraded(plan)) {
                    setInviteBlockedPopupReason("cant_invite_free_plan");
                  } else if (subscription.paymentFailingSince) {
                    setInviteBlockedPopupReason("cant_invite_payment_failure");
                  } else if (!workspaceHasAvailableSeats) {
                    setInviteBlockedPopupReason(
                      "cant_invite_no_seats_available"
                    );
                  } else {
                    setInviteEmailModalOpen(true);
                  }
                }}
              />
              {popup}
            </div>
          </div>
          <div className="s-w-full">
            <div className="space-y-2 pt-4">
              <Page.H variant="h5">Invitations</Page.H>
              <RenderInvitations
                invitations={invitations}
                isInvitationsLoading={isInvitationsLoading}
                onClickEvent={async (invitation: MembershipInvitationType) => {
                  await revokeInvitation({
                    owner,
                    invitation,
                    mutate,
                    sendNotification,
                    confirm,
                  });
                }}
                searchText={searchText}
              />
            </div>
            <div className="space-y-2 pb-3 pt-4">
              <Page.H variant="h5">Members</Page.H>
              <RenderMembers
                users={members}
                currentUserId={user.id}
                isMembersLoading={isMembersLoading}
                onClickEvent={(role) => setChangeRoleMember(role)}
                searchText={searchText}
              />
            </div>
          </div>
        </Page.Vertical>
      </>
    );
  }
}

function InviteEmailModal({
  showModal,
  onClose,
  owner,
  plan,
  members,
}: {
  showModal: boolean;
  onClose: () => void;
  owner: WorkspaceType;
  plan: PlanType;
  members: UserTypeWithWorkspaces[];
}) {
  const [inviteEmails, setInviteEmails] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [emailError, setEmailError] = useState("");
  const { mutate } = useSWRConfig();
  const sendNotification = useContext(SendNotificationsContext);
  const confirm = useContext(ConfirmContext);
  const [invitationRole, setInvitationRole] = useState<ActiveRoleType>("user");

  function getEmailsList(): string[] | null {
    const inviteEmailsList = inviteEmails
      .split(/[\n,]+/)
      .map((e) => e.trim())
      .filter((e) => e !== "")
      // remove duplicates
      .filter((e, i, self) => self.indexOf(e) === i);
    if (inviteEmailsList.map(isEmailValid).includes(false)) {
      setEmailError(
        "Invalid email addresses: " +
          inviteEmailsList.filter((e) => !isEmailValid(e)).join(", ")
      );
      return null;
    }
    return inviteEmailsList;
  }

  async function handleSendInvitations(
    inviteEmailsList: string[]
  ): Promise<void> {
    if (
      inviteEmailsList.length > MAX_UNCONSUMED_INVITATIONS_PER_WORKSPACE_PER_DAY
    ) {
      sendNotification({
        type: "error",
        title: "Too many invitations",
        description: `Your cannot send more than ${MAX_UNCONSUMED_INVITATIONS_PER_WORKSPACE_PER_DAY} invitations per day.`,
      });
      return;
    }

    const invitesByCase = {
      activeSameRole: members.filter((m) =>
        inviteEmailsList.find(
          (e) => m.email === e && m.workspaces[0].role === invitationRole
        )
      ),
      activeDifferentRole: members.filter((m) =>
        inviteEmailsList.find(
          (e) =>
            m.email === e &&
            m.workspaces[0].role !== invitationRole &&
            m.workspaces[0].role !== "none"
        )
      ),
      revoked: members.filter((m) =>
        inviteEmailsList.find(
          (e) => m.email === e && m.workspaces[0].role === "none"
        )
      ),
      notInWorkspace: inviteEmailsList.filter(
        (e) => !members.find((m) => m.email === e)
      ),
    };

    const { notInWorkspace, activeDifferentRole, revoked } = invitesByCase;

    const ReinviteUsersMessage = (
      <div className="mt-6 flex flex-col gap-6 px-2">
        {revoked.length > 0 && (
          <div>
            <div>
              The user(s) below were previously revoked from your workspace.
              Reinstating them will also immediately reinstate their
              conversation history on Dust.
            </div>
            <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto rounded border p-2 text-xs">
              {revoked.map((user) => (
                <div
                  key={user.email}
                >{`- ${user.fullName} (${user.email})`}</div>
              ))}
            </div>
          </div>
        )}
        {activeDifferentRole.length > 0 && (
          <div>
            <div>
              The user(s) below are already in your workspace with a different
              role. Moving forward will change their role to{" "}
              <span className="font-bold">{displayRole(invitationRole)}</span>.
            </div>
            <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto rounded border p-2 text-xs">
              {activeDifferentRole.map((user) => (
                <div key={user.email}>{`- ${
                  user.fullName
                } (current role: ${displayRole(
                  user.workspaces[0].role
                )})`}</div>
              ))}
            </div>
          </div>
        )}

        <div>Do you want to proceed?</div>
      </div>
    );
    const hasExistingMembers =
      activeDifferentRole.length > 0 || revoked.length > 0;

    const shouldProceedWithInvites =
      !hasExistingMembers ||
      (await confirm({
        title: "Some users are already in the workspace",
        message: ReinviteUsersMessage,
        validateLabel: "Yes, proceed",
        validateVariant: "primaryWarning",
      }));

    if (shouldProceedWithInvites) {
      await sendInvitations({
        owner,
        emails: notInWorkspace,
        invitationRole,
        sendNotification,
      });

      if (hasExistingMembers) {
        await handleMembersRoleChange({
          members: [...activeDifferentRole, ...revoked],
          role: invitationRole,
          sendNotification,
        });
        await mutate(`/api/w/${owner.sId}/members`);
      }

      await mutate(`/api/w/${owner.sId}/invitations`);
      onClose();
    }
  }

  return (
    <>
      <Modal
        isOpen={showModal}
        onClose={onClose}
        hasChanged={emailError === "" && inviteEmails !== "" && !isSending}
        title="Invite new users"
        variant="side-sm"
        saveLabel="Invite"
        isSaving={isSending}
        onSave={async () => {
          const inviteEmailsList = getEmailsList();
          if (!inviteEmailsList) {
            return;
          }
          setIsSending(true);
          await handleSendInvitations(inviteEmailsList);
          setIsSending(false);
          setInviteEmails("");
        }}
        className="flex"
      >
        <div className="mt-6 flex grow flex-col gap-6 px-2 text-sm">
          <div className="flex flex-grow flex-col gap-5">
            <div className="font-semibold">
              Email addresses (comma or newline separated):
            </div>
            <div className="flex items-start gap-2">
              <div className="flex-grow">
                <TextArea
                  placeholder="Email addresses, comma or newline separated"
                  value={inviteEmails}
                  onChange={(value) => {
                    setInviteEmails(value);
                    setEmailError("");
                  }}
                  error={emailError}
                  showErrorLabel={true}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="font-semibold text-element-900">Role:</div>
                <RoleDropDown
                  selectedRole={invitationRole}
                  onChange={setInvitationRole}
                />
              </div>
            </div>
            <div className="text-element-700">
              {ROLES_DATA[invitationRole]["description"]}
            </div>
          </div>
          {isProPlanCode(plan.code) && (
            <div className="justify-self-end">
              <ProPlanBillingNotice />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

function ProPlanBillingNotice() {
  return (
    <ContentMessage size="md" variant="amber" title="Note">
      <p>
        New users will be charged a{" "}
        <span className="font-semibold">
          monthly fee of {getPriceWithCurrency(PRO_PLAN_29_COST)}
        </span>
        .{" "}
      </p>
      <br />
      <p>
        Next month's bill will be adjusted proportionally based on the members'
        sign-up date.
      </p>
    </ContentMessage>
  );
}

function DomainAutoJoinModal({
  domain,
  domainAutoJoinEnabled,
  isOpen,
  onClose,
  owner,
}: {
  domain: string;
  domainAutoJoinEnabled: boolean;
  isOpen: boolean;
  onClose: () => void;
  owner: WorkspaceType;
}) {
  const sendNotification = useContext(SendNotificationsContext);

  const title = domainAutoJoinEnabled
    ? "De-activate Auto-join"
    : "Activate Auto-join";
  const validateLabel = domainAutoJoinEnabled ? "De-activate" : "Activate";
  const validateVariant = domainAutoJoinEnabled ? "primaryWarning" : "primary";
  const description = domainAutoJoinEnabled ? (
    "New members will need to be invited in order to gain access to your Dust Workspace."
  ) : (
    <span>
      Anyone with Google <span className="font-bold">{"@" + domain}</span>{" "}
      account will have access to your Dust Workspace.
    </span>
  );

  async function handleUpdateWorkspace(): Promise<void> {
    const res = await fetch(`/api/w/${owner.sId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain,
        domainAutoJoinEnabled: !domainAutoJoinEnabled,
      }),
    });

    if (!res.ok) {
      sendNotification({
        type: "error",
        title: "Update failed",
        description: `Failed to enable auto-add for whitelisted domain.`,
      });
    } else {
      // We perform a full refresh so that the Workspace name updates and we get a fresh owner
      // object so that the formValidation logic keeps working.
      window.location.reload();
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      title={title}
      onValidate={async () => {
        await handleUpdateWorkspace();
        onClose();
      }}
      onCancel={() => onClose()}
      validateLabel={validateLabel}
      validateVariant={validateVariant}
    >
      <div>{description}</div>
    </Dialog>
  );
}

async function revokeInvitation({
  owner,
  invitation,
  mutate,
  sendNotification,
  confirm,
}: {
  invitation: MembershipInvitationType;
  owner: WorkspaceType;
  mutate: any;
  sendNotification: (notificationData: NotificationType) => void;
  confirm: (confirmData: ConfirmDataType) => Promise<boolean>;
}) {
  if (
    !(await confirm({
      title: "Revoke invitation",
      message: `Are you sure you want to revoke the invitation for ${invitation.inviteEmail}?`,
      validateLabel: "Yes, revoke",
      validateVariant: "primaryWarning",
    }))
  ) {
    return;
  }

  const res = await fetch(`/api/w/${owner.sId}/invitations/${invitation.sId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "revoked",
    }),
  });
  if (!res.ok) {
    sendNotification({
      type: "error",
      title: "Revoke failed",
      description: "Failed to revoke member's invitation.",
    });
  } else {
    sendNotification({
      type: "success",
      title: "Invitation revoked",
      description: `Invitation revoked for ${invitation.inviteEmail}.`,
    });
    await mutate(`/api/w/${owner.sId}/invitations`);
  }
}

async function handleMembersRoleChange({
  members,
  role,
  sendNotification,
}: {
  members: UserTypeWithWorkspaces[];
  role: RoleType;
  sendNotification: any;
}): Promise<void> {
  if (members.length === 0) {
    return;
  }
  const promises = members.map((member) =>
    fetch(`/api/w/${member.workspaces[0].sId}/members/${member.sId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: role === "none" ? "revoked" : role,
      }),
    })
  );
  const results = await Promise.all(promises);
  const errors = results.filter((res) => !res.ok);
  if (errors.length > 0) {
    sendNotification({
      type: "error",
      title: "Update failed",
      description: `Failed to update members role for ${
        errors.length
      } member(s) (${members.length - errors.length} succeeded).`,
    });
  } else {
    sendNotification({
      type: "success",
      title: "Role updated",
      description: `Role updated to ${role} for ${members.length} member(s).`,
    });
  }
}

function ChangeMemberModal({
  onClose,
  member,
  owner,
}: {
  onClose: () => void;
  member: UserTypeWithWorkspaces | null;
  owner: WorkspaceType;
}) {
  assert(
    member?.workspaces[0].role !== "none",
    "Unreachable (typescript pleasing): member role cannot be none"
  );
  const { mutate } = useSWRConfig();
  const sendNotification = useContext(SendNotificationsContext);
  const [revokeMemberModalOpen, setRevokeMemberModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<ActiveRoleType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!member) {
    return null;
  }

  return (
    <ElementModal
      openOnElement={member}
      onClose={() => {
        onClose();
        setSelectedRole(null);
        setIsSaving(false);
      }}
      isSaving={isSaving}
      hasChanged={selectedRole !== member.workspaces[0].role}
      title={member.fullName || "Unreachable"}
      variant="side-sm"
      onSave={async (closeModalFn: () => void) => {
        if (!selectedRole) {
          return;
        }
        setIsSaving(true);
        await handleMembersRoleChange({
          members: [member],
          role: selectedRole,
          sendNotification,
        });
        await mutate(`/api/w/${owner.sId}/members`);
        closeModalFn();
      }}
      saveLabel="Update role"
    >
      <Page variant="modal">
        <div className="mt-6 flex flex-col gap-9 text-sm text-element-700">
          <div className="flex items-center gap-4">
            <Avatar size="lg" visual={member.image} name={member.fullName} />
            <div className="flex grow flex-col">
              <div className="font-semibold text-element-900">
                {member.fullName}
              </div>
              <div className="font-normal">{member.email}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="font-bold text-element-900">Role:</div>
              <RoleDropDown
                selectedRole={selectedRole || member.workspaces[0].role}
                onChange={setSelectedRole}
              />
            </div>
            <Page.P>
              The role defines the rights of a member of the workspace.{" "}
              {ROLES_DATA[member.workspaces[0].role]["description"]}
            </Page.P>
          </div>
          <div className="flex flex-none flex-col gap-2">
            <div className="flex-none">
              <Button
                variant="primaryWarning"
                label="Revoke member access"
                size="sm"
                onClick={() => setRevokeMemberModalOpen(true)}
              />
            </div>
            <Page.P>
              Deleting a member will remove them from the workspace. They will
              be able to rejoin if they have an invitation link.
            </Page.P>
          </div>
        </div>
      </Page>
      <Dialog
        isOpen={revokeMemberModalOpen}
        title="Revoke member access"
        onValidate={async () => {
          await handleMembersRoleChange({
            members: [member],
            role: "none",
            sendNotification,
          });
          await mutate(`/api/w/${owner.sId}/members`);
          setRevokeMemberModalOpen(false);
          onClose();
        }}
        validateLabel="Yes, revoke"
        validateVariant="primaryWarning"
        onCancel={() => {
          setRevokeMemberModalOpen(false);
        }}
        isSaving={isSaving}
      >
        <div>
          Revoke access for user{" "}
          <span className="font-bold">{member.fullName}</span>?
        </div>
      </Dialog>
    </ElementModal>
  );
}



function RoleDropDown({
  selectedRole,
  onChange,
}: {
  selectedRole: ActiveRoleType;
  onChange: (role: ActiveRoleType) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Button>
        <div className="group flex cursor-pointer items-center gap-2">
          <Chip
            color={ROLES_DATA[selectedRole]["color"]}
            className="capitalize"
          >
            {displayRole(selectedRole)}
          </Chip>
          <IconButton
            icon={ChevronDownIcon}
            size="sm"
            variant="secondary"
            className="group-hover:text-action-400"
          />
        </div>
      </DropdownMenu.Button>
      <DropdownMenu.Items origin="topLeft">
        {ACTIVE_ROLES.map((role) => (
          <DropdownMenu.Item
            key={role}
            onClick={() => onChange(role)}
            label={
              displayRole(role).charAt(0).toUpperCase() +
              displayRole(role).slice(1)
            }
          />
        ))}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}

async function sendInvitations({
  owner,
  emails,
  invitationRole,
  sendNotification,
}: {
  owner: WorkspaceType;
  emails: string[];
  invitationRole: ActiveRoleType;
  sendNotification: any;
}) {
  const body: PostInvitationRequestBody = emails.map((email) => ({
    email,
    role: invitationRole,
  }));

  const res = await fetch(`/api/w/${owner.sId}/invitations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let data: any = {};
    try {
      data = await res.json();
    } catch (e) {
      // ignore
    }
    if (data?.error?.type === "invitation_already_sent_recently") {
      sendNotification({
        type: "error",
        title: emails.length === 1 ? "Invite failed" : "Invites failed",
        description:
          (emails.length === 1 ? "This user has" : "These users have") +
          " already been invited in the last 24 hours. Please wait before sending another invite.",
      });
    }

    sendNotification({
      type: "error",
      title: "Invite failed",
      description:
        "Failed to invite new members to workspace: " + res.statusText,
    });
  } else {
    const result: PostInvitationResponseBody = await res.json();
    const failures = result.filter((r) => !r.success);

    if (failures.length > 0) {
      sendNotification({
        type: "error",
        title: "Some invites failed",
        description:
          result[0].error_message ||
          `Failed to invite ${failures} new member(s) to workspace.`,
      });
    } else {
      sendNotification({
        type: "success",
        title: "Invites sent",
        description: `${emails.length} new invites sent.`,
      });
    }
  }
}
