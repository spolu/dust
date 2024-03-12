import { EmotionLaughIcon, IconButton, TrashIcon } from "@dust-tt/sparkle";
import type {
  LightAgentConfigurationType,
  WorkspaceType,
} from "@dust-tt/types";
import { ArrowsUpDownIcon } from "@heroicons/react/20/solid";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { formatTimestampToFriendlyDate } from "@app/lib/utils";

type AgentConfigurationDisplayType = {
  // TODO(2024-02-28 flav) Add description preview.
  // description: string;
  name: string;
  scope: string;
  sId: string;
  status: string;
  versionCreatedAt: string | null;
};

export function makeColumnsForAssistants(
  owner: WorkspaceType,
  agentConfigurations: LightAgentConfigurationType[],
  reload: () => void
): ColumnDef<AgentConfigurationDisplayType>[] {
  return [
    {
      accessorKey: "sId",
      cell: ({ row }) => {
        const sId: string = row.getValue("sId");

        return (
          <Link
            className="font-bold hover:underline"
            href={`/poke/${owner.sId}/assistants/${sId}`}
          >
            {sId}
          </Link>
        );
      },
      header: ({ column }) => {
        return (
          <div className="flex space-x-2">
            <p>Id</p>
            <IconButton
              variant="tertiary"
              icon={ArrowsUpDownIcon}
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            />
          </div>
        );
      },
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <div className="flex space-x-2">
            <p>Name</p>
            <IconButton
              variant="tertiary"
              icon={ArrowsUpDownIcon}
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            />
          </div>
        );
      },
    },
    {
      accessorKey: "scope",
      header: "Scope",
    },
    {
      accessorKey: "status",
      header: "Status",
    },
    {
      accessorKey: "versionCreatedAt",
      header: "Created at",
      cell: ({ row }) => {
        const createdAt: string | null = row.getValue("versionCreatedAt");

        if (!createdAt) {
          return;
        }

        return formatTimestampToFriendlyDate(new Date(createdAt).getTime());
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const assistant = row.original;

        return (
          <IconButton
            icon={
              assistant.status !== "archived" ? TrashIcon : EmotionLaughIcon
            }
            size="xs"
            variant="tertiary"
            onClick={async () => {
              await (assistant.status !== "archived"
                ? archiveAssistant(owner, reload, assistant)
                : resurrectAssistant(owner, reload, assistant));
            }}
          />
        );
      },
    },
  ];
}

async function archiveAssistant(
  owner: WorkspaceType,
  reload: () => void,
  agentConfiguration: AgentConfigurationDisplayType
) {
  if (
    !window.confirm(
      `Are you sure you want to archive the ${agentConfiguration.name} assistant?`
    )
  ) {
    return;
  }

  try {
    const r = await fetch(
      `/api/poke/workspaces/${owner.sId}/agent_configurations/${agentConfiguration.sId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    if (!r.ok) {
      throw new Error("Failed to archive agent configuration.");
    }

    reload();
  } catch (e) {
    console.error(e);
    window.alert("An error occurred while archiving the agent configuration.");
  }
}

async function resurrectAssistant(
  owner: WorkspaceType,
  reload: () => void,
  agentConfiguration: AgentConfigurationDisplayType
) {
  if (
    !window.confirm(
      `Are you sure you want to resurrect the ${agentConfiguration.name} assistant?`
    )
  ) {
    return;
  }

  try {
    const r = await fetch(
      `/api/poke/workspaces/${owner.sId}/agent_configurations/${agentConfiguration.sId}/resurrect`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    if (!r.ok) {
      throw new Error("Failed to resurrect agent configuration.");
    }

    reload();
  } catch (e) {
    console.error(e);
    window.alert(
      "An error occurred while resurrecting the agent configuration."
    );
  }
}
