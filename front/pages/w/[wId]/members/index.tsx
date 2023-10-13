import {
  Avatar,
  Button,
  ChevronRightIcon,
  Chip,
  ClipboardIcon,
  Cog6ToothIcon,
  DropdownMenu,
  Input,
  Modal,
  Page,
  PlusIcon,
  QuestionMarkCircleStrokeIcon,
  Searchbar,
} from "@dust-tt/sparkle";
import { UsersIcon } from "@heroicons/react/20/solid";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useState } from "react";
import React from "react";
import { useSWRConfig } from "swr";

import AppLayout from "@app/components/sparkle/AppLayout";
import { subNavigationAdmin } from "@app/components/sparkle/navigation";
import {
  Authenticator,
  getSession,
  getUserFromSession,
  RoleType,
} from "@app/lib/auth";
import { useMembers, useWorkspaceInvitations } from "@app/lib/swr";
import { classNames, isEmailValid } from "@app/lib/utils";
import { MembershipInvitationType } from "@app/types/membership_invitation";
import { UserType, WorkspaceType } from "@app/types/user";

const { GA_TRACKING_ID = "", URL = "" } = process.env;

export const getServerSideProps: GetServerSideProps<{
  user: UserType | null;
  owner: WorkspaceType;
  gaTrackingId: string;
  url: string;
}> = async (context) => {
  const session = await getSession(context.req, context.res);
  const user = await getUserFromSession(session);
  const auth = await Authenticator.fromSession(
    session,
    context.params?.wId as string
  );

  const owner = auth.workspace();
  if (!owner || !auth.isAdmin()) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      user,
      owner,
      gaTrackingId: GA_TRACKING_ID,
      url: URL,
    },
  };
};

export default function WorkspaceAdmin({
  user,
  owner,
  gaTrackingId,
  url,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const inviteLink =
    owner.allowedDomain !== null ? `${url}/w/${owner.sId}/join` : null;
  const { members } = useMembers(owner);
  const { invitations } = useWorkspaceInvitations(owner);
  const [inviteSettingsModalOpen, setInviteSettingsModalOpen] = useState(false);

  return (
    <AppLayout
      user={user}
      owner={owner}
      gaTrackingId={gaTrackingId}
      topNavigationCurrent="settings"
      subNavigation={subNavigationAdmin({ owner, current: "members" })}
    >
      <Page>
        <div className="flex flex-col gap-6">
          <Page.Header
            title="Member Management"
            icon={UsersIcon}
            description="Invite and remove members, manage their rights."
          />
          <div>
            <InviteSettingsModal
              showModal={inviteSettingsModalOpen}
              onClose={() => {
                setInviteSettingsModalOpen(false);
              }}
              owner={owner}
            />
            <Page.SectionHeader
              title="Invitation Link"
              description="Allow any person with the right email domain name (@company.com) to signup and join your workspace."
            />
            {inviteLink ? (
              <div className="pt-1 text-element-700">
                Invitation link is activated for domain{" "}
                <span className="font-bold">{`@${owner.allowedDomain}`}</span>
                <div className="mt-3 flex flex-col justify-between gap-2 sm:flex-row">
                  <div className="flex-grow">
                    <Input
                      className=""
                      disabled
                      placeholder={""}
                      value={inviteLink}
                      name={""}
                    />
                  </div>
                  <div className="relative bottom-0.5 flex flex-row gap-2">
                    <div className="flex-none">
                      <Button
                        variant="secondary"
                        label="Copy"
                        size="sm"
                        icon={ClipboardIcon}
                        onClick={() => {
                          void navigator.clipboard.writeText(inviteLink);
                        }}
                      />
                    </div>
                    <div className="flex-none">
                      <Button
                        variant="secondary"
                        label="Settings"
                        size="sm"
                        icon={Cog6ToothIcon}
                        onClick={() => setInviteSettingsModalOpen(true)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div></div>
            )}
          </div>
          <MemberList members={members} invitations={invitations} />
        </div>
      </Page>
    </AppLayout>
  );

  function MemberList({
    members,
    invitations,
  }: {
    members: UserType[];
    invitations: MembershipInvitationType[];
  }) {
    const COLOR_FOR_ROLE: { [key: string]: "warning" | "amber" | "emerald" } = {
      admin: "warning",
      builder: "amber",
      user: "emerald",
    };
    const [searchText, setSearchText] = useState("");

    const displayedMembersAndInvitations = [
      ...members
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((m) => m.workspaces[0].role !== "none")
        .filter(
          (m) =>
            !searchText ||
            m.name.toLowerCase().includes(searchText) ||
            m.email?.toLowerCase().includes(searchText) ||
            m.username?.toLowerCase().includes(searchText)
        ),
      ...invitations
        .sort((a, b) => a.inviteEmail.localeCompare(b.inviteEmail))
        .filter((i) => i.status === "pending")
        .filter(
          (i) => !searchText || i.inviteEmail.toLowerCase().includes(searchText)
        ),
    ];

    const [inviteEmailModalOpen, setInviteEmailModalOpen] = useState(false);
    /** Modal for changing member role: we need to use 2 states: set the member
     * on hover, open modal on click. Using only 1 state for both would break
     * the modal animation because rerendering at the same time than switching
     * modal to open*/
    const [changeRoleModalOpen, setChangeRoleModalOpen] = useState(false);
    const [changeRoleMember, setChangeRoleMember] = useState<UserType | null>(
      null
    );

    /* Same for invitations modal */
    const [revokeInvitationModalOpen, setRevokeInvitationModalOpen] =
      useState(false);
    const [invitationToRevoke, setInvitationToRevoke] =
      useState<MembershipInvitationType | null>(null);
    return (
      <>
        <InviteEmailModal
          showModal={inviteEmailModalOpen}
          onClose={() => {
            setInviteEmailModalOpen(false);
          }}
          owner={owner}
        />
        <RevokeInvitationModal
          showModal={revokeInvitationModalOpen}
          invitation={invitationToRevoke}
          onClose={() => setRevokeInvitationModalOpen(false)}
          owner={owner}
        />
        <ChangeMemberModal
          showModal={changeRoleModalOpen}
          member={changeRoleMember}
          onClose={() => setChangeRoleModalOpen(false)}
          owner={owner}
        />
        <Page.SectionHeader title="Member list" />
        <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row">
          <div className="flex-grow">
            <Searchbar
              placeholder="Search members"
              onChange={setSearchText}
              value={searchText}
              name={""}
            />
          </div>
          <div className="flex-none">
            <Button
              variant="primary"
              label="Invite members"
              size="sm"
              icon={PlusIcon}
              onClick={() => setInviteEmailModalOpen(true)}
            />
          </div>
        </div>
        <div>
          {displayedMembersAndInvitations.map((item) => (
            <div
              key={
                isInvitation(item)
                  ? `invitation-${item.id}`
                  : `member-${item.id}`
              }
              className="flex cursor-pointer items-center justify-center gap-3 border-t border-structure-200 py-2 text-xs hover:bg-structure-100 sm:text-sm"
              onMouseEnter={() => {
                if (isInvitation(item)) setInvitationToRevoke(item);
                else setChangeRoleMember(item);
              }}
              onClick={() => {
                if (isInvitation(item)) setRevokeInvitationModalOpen(true);
                else setChangeRoleModalOpen(true);
              }}
            >
              <div className="hidden sm:block">
                {isInvitation(item) ? (
                  <QuestionMarkCircleStrokeIcon className="h-7 w-7" />
                ) : (
                  <Avatar visual={item.image} name={item.name} size="xs" />
                )}
              </div>
              <div className="flex grow flex-col gap-1 sm:flex-row sm:gap-3">
                {!isInvitation(item) && (
                  <div className="font-medium text-element-900">
                    {item.name}
                  </div>
                )}

                <div className="grow font-normal text-element-700">
                  {isInvitation(item)
                    ? item.inviteEmail
                    : item.email || item.username}
                </div>
              </div>
              <div>
                {isInvitation(item) ? (
                  <Chip size="xs" color="slate">
                    Invitation {item.status}
                  </Chip>
                ) : (
                  <Chip
                    size="xs"
                    color={COLOR_FOR_ROLE[item.workspaces[0].role]}
                    className={
                      /** Force tailwind to include classes we will need below */
                      "text-amber-900 text-emerald-900 text-warning-900"
                    }
                  >
                    <span
                      className={classNames(
                        "capitalize",
                        `text-${COLOR_FOR_ROLE[item.workspaces[0].role]}-900`
                      )}
                    >
                      {item.workspaces[0].role}
                    </span>
                  </Chip>
                )}
              </div>
              <div className="hidden sm:block">
                <ChevronRightIcon />
              </div>
            </div>
          ))}
        </div>
      </>
    );
    function isInvitation(
      arg: MembershipInvitationType | UserType
    ): arg is MembershipInvitationType {
      return (arg as MembershipInvitationType).inviteEmail !== undefined;
    }
  }
}

function InviteEmailModal({
  showModal,
  onClose,
  owner,
}: {
  showModal: boolean;
  onClose: () => void;
  owner: WorkspaceType;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const { mutate } = useSWRConfig();
  return (
    <Modal
      isOpen={showModal}
      onClose={onClose}
      hasChanged={false}
      title="Invite new users"
      type="right-side"
    >
      <div className="mt-6 flex flex-col gap-6 px-2 text-sm">
        <Page.P>
          Invite a new user to your workspace. They will receive an email with a
          link to join your workspace.
        </Page.P>
        <div className="flex flex-grow flex-col gap-1.5">
          <div className="font-semibold">Email to send invite to:</div>
          <div className="flex items-start gap-2">
            <div className="flex-grow">
              <Input
                placeholder={"Email address"}
                value={inviteEmail || ""}
                name={""}
                error={emailError}
                showErrorLabel={true}
                onChange={(e) => {
                  setInviteEmail(e.trim());
                  setEmailError("");
                }}
              />
            </div>
            <div className="flex-none">
              <Button
                variant="primary"
                label="Invite"
                size="sm"
                disabled={emailError !== "" || inviteEmail === "" || isSending}
                onClick={handleSendInvitation}
              />
            </div>
          </div>
        </div>
        {successMessage && (
          <div className="text-success-900">{successMessage}</div>
        )}
      </div>
    </Modal>
  );

  async function handleSendInvitation(): Promise<void> {
    if (!isEmailValid(inviteEmail)) {
      setEmailError("Invalid email address.");
      return;
    }
    setIsSending(true);
    const res = await fetch(`/api/w/${owner.sId}/invitations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inviteEmail,
      }),
    });
    if (!res.ok) {
      window.alert("Failed to invite new member to workspace.");
    } else {
      setSuccessMessage(
        `Invite sent to ${inviteEmail}. You can repeat the operation to invite other users.`
      );
      await mutate(`/api/w/${owner.sId}/invitations`);
    }
    setIsSending(false);
    setInviteEmail("");
  }
}

function InviteSettingsModal({
  showModal,
  onClose,
  owner,
}: {
  showModal: boolean;
  onClose: () => void;
  owner: WorkspaceType;
}) {
  const [domainUpdating, setDomainUpdating] = useState(false);
  const [domainInput, setDomainInput] = useState(owner.allowedDomain || "");
  const [allowedDomainError, setAllowedDomainError] = useState("");
  return (
    <Modal
      isOpen={showModal}
      onClose={onClose}
      hasChanged={
        domainInput !== owner.allowedDomain &&
        !allowedDomainError &&
        !domainUpdating
      }
      title="Invitation link settings"
      type="right-side"
      onSave={() => validDomain() && handleUpdateWorkspace()}
    >
      <div className="mt-6 flex flex-col gap-6 px-2">
        <div>
          Any person with a Google Workspace email on corresponding domain name
          will be allowed to join the workspace.
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="font-bold">Whitelisted email domain</div>
          <Input
            className="text-sm"
            placeholder={"Company domain"}
            value={domainInput}
            name={""}
            error={allowedDomainError}
            showErrorLabel={true}
            onChange={(e) => {
              setDomainInput(e);
              setAllowedDomainError("");
            }}
            disabled={domainUpdating}
          />
        </div>
      </div>
    </Modal>
  );

  async function handleUpdateWorkspace(): Promise<void> {
    setDomainUpdating(true);
    const res = await fetch(`/api/w/${owner.sId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        allowedDomain: domainInput,
      }),
    });
    if (!res.ok) {
      window.alert("Failed to update workspace.");
      setDomainUpdating(false);
    } else {
      // We perform a full refresh so that the Workspace name updates and we get a fresh owner
      // object so that the formValidation logic keeps working.
      window.location.reload();
    }
  }
  function validDomain(): boolean {
    let valid = true;
    if (domainInput === null) {
      setAllowedDomainError("");
    } else {
      // eslint-disable-next-line no-useless-escape
      if (!domainInput.match(/^[a-z0-9\.\-]+$/)) {
        setAllowedDomainError("Allowed domain must be a valid domain name.");
        valid = false;
      } else {
        setAllowedDomainError("");
      }
    }

    return valid;
  }
}

function RevokeInvitationModal({
  showModal,
  onClose,
  invitation,
  owner,
}: {
  showModal: boolean;
  onClose: () => void;
  invitation: MembershipInvitationType | null;
  owner: WorkspaceType;
}) {
  const { mutate } = useSWRConfig();

  return (
    <Modal
      isOpen={showModal}
      onClose={onClose}
      hasChanged={false}
      title="Revoke invitation"
      type="right-side"
    >
      <div className="mt-6 flex flex-col gap-6 px-2">
        <div>
          Revoke invitation for user with email{" "}
          <span className="font-bold">{invitation?.inviteEmail}</span>?
        </div>
        <div className="flex gap-2">
          <Button variant="tertiary" label="Cancel" onClick={onClose} />
          <Button
            variant="primaryWarning"
            label="Yes, revoke"
            onClick={() => invitation && handleRevokeInvitation(invitation.id)}
          />
        </div>
      </div>
    </Modal>
  );

  async function handleRevokeInvitation(invitationId: number): Promise<void> {
    const res = await fetch(`/api/w/${owner.sId}/invitations/${invitationId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "revoked",
      }),
    });
    if (!res.ok) {
      window.alert("Failed to revoke member's invitation.");
    } else {
      await mutate(`/api/w/${owner.sId}/invitations`);
    }
  }
}

function ChangeMemberModal({
  showModal,
  onClose,
  member,
  owner,
}: {
  showModal: boolean;
  onClose: () => void;
  member: UserType | null;
  owner: WorkspaceType;
}) {
  const { mutate } = useSWRConfig();
  if (!member) return null; // Unreachable
  const roleTexts: { [k: string]: string } = {
    admin: "Admins can manage members, in addition to builders' rights.",
    builder:
      "Builders can create custom assistants and use advanced dev tools.",
    user: "Users can use assistants provided by Dust as well as custom assistants created by their company.",
  };
  return (
    <Modal
      isOpen={showModal}
      onClose={onClose}
      hasChanged={false}
      title={member.name || "Unreachable"}
      type="right-side"
    >
      <div className="mt-6 flex flex-col gap-9 px-2 text-sm text-element-700">
        <div className="flex items-center gap-4">
          <Avatar size="lg" visual={member.image} name={member.name} />
          <div className="flex grow flex-col">
            <div className="font-semibold text-element-900">{member.name}</div>
            <div className="font-normal">{member.email}</div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="font-bold text-element-900">Role:</div>
            <DropdownMenu>
              <DropdownMenu.Button type="select">
                <Button
                  variant="secondary"
                  label={member.workspaces[0].role}
                  size="sm"
                  type="select"
                  className="capitalize"
                />
              </DropdownMenu.Button>
              <DropdownMenu.Items origin="topLeft">
                {["admin", "builder", "user"].map((role) => (
                  <DropdownMenu.Item
                    key={role}
                    onClick={() =>
                      handleMemberRoleChange(member, role as RoleType)
                    }
                    label={role.charAt(0).toUpperCase() + role.slice(1)}
                  />
                ))}
              </DropdownMenu.Items>
            </DropdownMenu>
          </div>
          <Page.P>
            The role defines the rights of a member of the workspace.{" "}
            {roleTexts[member.workspaces[0].role]}
          </Page.P>
        </div>
        <div className="flex flex-none flex-col gap-2">
          <div className="flex-none">
            <Button
              variant="primaryWarning"
              label="Revoke member access"
              size="sm"
              onClick={() => handleMemberRoleChange(member, "none")}
            />
          </div>
          <Page.P>
            Deleting a member will remove them from the workspace. They will be
            able to rejoin if they have an invitation link.
          </Page.P>
        </div>
      </div>
    </Modal>
  );
  async function handleMemberRoleChange(
    member: UserType,
    role: string
  ): Promise<void> {
    const res = await fetch(`/api/w/${owner.sId}/members/${member.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role,
      }),
    });
    if (!res.ok) {
      window.alert("Failed to update membership.");
    } else {
      await mutate(`/api/w/${owner.sId}/members`);
    }
  }
}
