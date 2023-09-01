import { DropdownMenu } from "@dust-tt/sparkle";

import { UserType, WorkspaceType } from "@app/types/user";

export default function WorkspacePicker({
  user,
  workspace,
  onWorkspaceUpdate,
}: {
  user: UserType;
  workspace: WorkspaceType | null;
  readOnly: boolean;
  onWorkspaceUpdate: (w: WorkspaceType) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Button
        label={workspace ? workspace.name : "Select workspace"}
      />

      <DropdownMenu.Items>
        {user.workspaces.map((w) => {
          return (
            <DropdownMenu.Item key={w.sId}>
              <span onClick={() => onWorkspaceUpdate(w)}>{w.name}</span>
            </DropdownMenu.Item>
          );
        })}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}
