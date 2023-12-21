import {
  Avatar,
  Button,
  ClipboardIcon,
  CloudArrowDownIcon,
  CommandLineIcon,
  DashIcon,
  Modal,
  PlusIcon,
  ServerIcon,
  TrashIcon,
} from "@dust-tt/sparkle";
import {
  AgentUsageType,
  AgentUserListStatus,
  ConnectorProvider,
  DatabaseQueryConfigurationType,
  isDatabaseQueryConfiguration,
} from "@dust-tt/types";
import {
  DustAppRunConfigurationType,
  isDustAppRunConfiguration,
} from "@dust-tt/types";
import {
  DataSourceConfiguration,
  isRetrievalConfiguration,
} from "@dust-tt/types";
import { AgentConfigurationType } from "@dust-tt/types";
import { WorkspaceType } from "@dust-tt/types";
import Link from "next/link";
import { useContext, useState } from "react";
import ReactMarkdown from "react-markdown";

import { SendNotificationsContext } from "@app/components/sparkle/Notification";
import { CONNECTOR_CONFIGURATIONS } from "@app/lib/connector_providers";
import { useAgentUsage, useApp, useDatabase } from "@app/lib/swr";
import { PostAgentListStatusRequestBody } from "@app/pages/api/w/[wId]/members/me/agent_list_status";

import { DeleteAssistantDialog } from "./AssistantActions";

type AssistantDetailsFlow = "personal" | "workspace";

export function AssistantDetails({
  owner,
  assistant,
  show,
  onClose,
  onUpdate,
  flow,
}: {
  owner: WorkspaceType;
  assistant: AgentConfigurationType;
  show: boolean;
  onClose: () => void;
  onUpdate: () => void;
  flow: AssistantDetailsFlow;
}) {
  const agentUsage = useAgentUsage({
    workspaceId: owner.sId,
    agentConfigurationId: assistant.sId,
  });
  const DescriptionSection = () => (
    <div className="flex flex-col gap-4 sm:flex-row">
      <Avatar
        visual={<img src={assistant.pictureUrl} alt="Assistant avatar" />}
        size="md"
      />
      <div>{assistant.description}</div>
    </div>
  );

  const InstructionsSection = () =>
    assistant.generation?.prompt ? (
      <div className="flex flex-col gap-2">
        <div className="text-lg font-bold text-element-800">Instructions</div>
        <ReactMarkdown>{assistant.generation.prompt}</ReactMarkdown>
      </div>
    ) : (
      "This assistant has no instructions."
    );

  const UsageSection = ({
    usage,
    isLoading,
    isError,
  }: {
    usage: AgentUsageType | null;
    isLoading: boolean;
    isError: boolean;
  }) => (
    <div className="flex flex-col gap-2">
      <div className="text-lg font-bold text-element-800">Usage</div>
      {(() => {
        if (isError) {
          return "Error loading usage data.";
        } else if (isLoading) {
          return "Loading usage data...";
        } else if (usage) {
          return (
            <>
              @{assistant.name} has been used by {usage.userCount} people in{" "}
              {usage.messageCount} message(s) over the last{" "}
              {usage.timePeriodSec / (60 * 60 * 24)} days.
            </>
          );
        }
      })()}
    </div>
  );

  const ActionSection = () =>
    assistant.action ? (
      isDustAppRunConfiguration(assistant.action) ? (
        <div className="flex flex-col gap-2">
          <div className="text-lg font-bold text-element-800">Action</div>
          <DustAppSection dustApp={assistant.action} owner={owner} />
        </div>
      ) : isRetrievalConfiguration(assistant.action) ? (
        <div className="flex flex-col gap-2">
          <div className="text-lg font-bold text-element-800">
            Data source(s)
          </div>
          <DataSourcesSection
            dataSourceConfigurations={assistant.action.dataSources}
          />
        </div>
      ) : isDatabaseQueryConfiguration(assistant.action) ? (
        <div className="flex flex-col gap-2">
          <div className="text-lg font-bold text-element-800">Database</div>
          <DatabaseQuerySection
            databaseQueryConfig={assistant.action}
            owner={owner}
          />
        </div>
      ) : null
    ) : null;

  return (
    <Modal
      isOpen={show}
      title={`@${assistant.name}`}
      onClose={onClose}
      hasChanged={false}
      variant="side-sm"
    >
      <div className="flex flex-col gap-5 p-6 text-sm text-element-700">
        <ButtonsSection
          owner={owner}
          agentConfiguration={assistant}
          detailsModalClose={onClose}
          onUpdate={onUpdate}
          onClose={onClose}
          flow={flow}
        />
        <DescriptionSection />
        <InstructionsSection />
        <UsageSection
          usage={agentUsage.agentUsage}
          isLoading={agentUsage.isAgentUsageLoading}
          isError={agentUsage.isAgentUsageError}
        />
        <ActionSection />
      </div>
    </Modal>
  );
}

function DataSourcesSection({
  dataSourceConfigurations,
}: {
  dataSourceConfigurations: DataSourceConfiguration[];
}) {
  const getProviderName = (ds: DataSourceConfiguration) =>
    ds.dataSourceId.startsWith("managed-")
      ? (ds.dataSourceId.slice(8) as ConnectorProvider)
      : undefined;

  const compareDatasourceNames = (
    a: DataSourceConfiguration,
    b: DataSourceConfiguration
  ) => {
    const aProviderName = getProviderName(a);
    const bProviderName = getProviderName(b);
    if (aProviderName && bProviderName) {
      return aProviderName > bProviderName ? -1 : 1;
    }
    if (aProviderName) {
      return -1;
    }
    if (bProviderName) {
      return 1;
    }
    return a.dataSourceId > b.dataSourceId ? -1 : 1;
  };

  return (
    <div className="flex flex-col gap-1">
      {dataSourceConfigurations.sort(compareDatasourceNames).map((ds) => {
        const providerName = getProviderName(ds);
        const DsLogo = providerName
          ? CONNECTOR_CONFIGURATIONS[providerName].logoComponent
          : CloudArrowDownIcon;
        const dsDocumentNumberText = `(${
          ds.filter.parents?.in.length ?? "all"
        } element(s))`;
        return (
          <div className="flex flex-col gap-2" key={ds.dataSourceId}>
            <div className="flex items-center gap-2">
              <div>
                <DsLogo />
              </div>
              <div>{`${
                providerName ?? ds.dataSourceId
              } ${dsDocumentNumberText}`}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DustAppSection({
  owner,
  dustApp,
}: {
  owner: WorkspaceType;
  dustApp: DustAppRunConfigurationType;
}) {
  const { app } = useApp({ workspaceId: owner.sId, appId: dustApp.appId });
  return (
    <div className="flex flex-col gap-2">
      <div>The following action is run before answering:</div>
      <div className="flex items-center gap-2 capitalize">
        <div>
          <CommandLineIcon />
        </div>
        <div>{app ? app.name : ""}</div>
      </div>
    </div>
  );
}

function DatabaseQuerySection({
  owner,
  databaseQueryConfig,
}: {
  owner: WorkspaceType;
  databaseQueryConfig: DatabaseQueryConfigurationType;
}) {
  const { database } = useDatabase({
    workspaceId: owner.sId,
    dataSourceName: databaseQueryConfig.dataSourceId,
    databaseId: databaseQueryConfig.databaseId,
  });

  if (database) {
    return (
      <div className="flex flex-col gap-2">
        <div>The following database is queried before answering:</div>
        <div className="flex items-center gap-2 capitalize">
          <div>
            <ServerIcon />
          </div>
          <div>{database.name}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div>
        No database selected, please check the configuration of this Assistant!
      </div>
    </div>
  );
}

function ButtonsSection({
  owner,
  agentConfiguration,
  detailsModalClose,
  onUpdate,
  onClose,
  flow,
}: {
  owner: WorkspaceType;
  agentConfiguration: AgentConfigurationType;
  detailsModalClose: () => void;
  onUpdate: () => void;
  onClose: () => void;
  flow: AssistantDetailsFlow;
}) {
  const [showDeletionModal, setShowDeletionModal] = useState<boolean>(false);

  const canDelete =
    (agentConfiguration.scope === "workspace" &&
      ["builder", "admin"].includes(owner.role)) ||
    ["published", "private"].includes(agentConfiguration.scope);

  const canAddRemoveList =
    ["published", "workspace"].includes(agentConfiguration.scope) &&
    flow !== "workspace";

  const [isDuplicating, setIsDuplicating] = useState<boolean>(false);
  const [isAddingOrRemoving, setIsAddingOrRemoving] = useState<boolean>(false);
  const sendNotification = useContext(SendNotificationsContext);

  const updateAgentUserListStatus = async (listStatus: AgentUserListStatus) => {
    setIsAddingOrRemoving(true);

    const body: PostAgentListStatusRequestBody = {
      agentId: agentConfiguration.sId,
      listStatus,
    };

    const res = await fetch(
      `/api/w/${owner.sId}/members/me/agent_list_status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const data = await res.json();
      sendNotification({
        title: `Error ${
          listStatus === "in-list" ? "adding" : "removing"
        } Assistant`,
        description: data.error.message,
        type: "error",
      });
    } else {
      sendNotification({
        title: `Assistant ${listStatus === "in-list" ? "added" : "removed"}`,
        type: "success",
      });
      onUpdate();
    }

    setIsAddingOrRemoving(false);
    onClose();
  };

  return (
    <Button.List className="flex items-center justify-end gap-1">
      <Link
        href={`/w/${owner.sId}/builder/assistants/new?flow=personal_assistants&duplicate=${agentConfiguration.sId}`}
      >
        <Button
          label={isDuplicating ? "Duplicating..." : "Duplicate"}
          disabled={isDuplicating}
          variant="tertiary"
          icon={ClipboardIcon}
          size="xs"
          onClick={async () => {
            setIsDuplicating(true);
          }}
        />
      </Link>
      {canAddRemoveList &&
        (agentConfiguration.userListStatus === "in-list" ? (
          <Button
            label={isAddingOrRemoving ? "Removing..." : "Remove from my list"}
            disabled={isAddingOrRemoving}
            variant="tertiary"
            icon={DashIcon}
            size="xs"
            onClick={async () => {
              await updateAgentUserListStatus("not-in-list");
            }}
          />
        ) : (
          <Button
            label={isAddingOrRemoving ? "Adding..." : "Add to my list"}
            disabled={isAddingOrRemoving}
            variant="tertiary"
            icon={PlusIcon}
            size="xs"
            onClick={async () => {
              await updateAgentUserListStatus("in-list");
            }}
          />
        ))}

      {canDelete && (
        <>
          <DeleteAssistantDialog
            owner={owner}
            agentConfigurationId={agentConfiguration.sId}
            show={showDeletionModal}
            onClose={() => setShowDeletionModal(false)}
            onDelete={() => {
              detailsModalClose();
              onUpdate();
            }}
          />
          <Button
            label={"Delete"}
            icon={TrashIcon}
            variant="secondaryWarning"
            size="xs"
            disabled={!["builder", "admin"].includes(owner.role)}
            onClick={() => setShowDeletionModal(true)}
          />
        </>
      )}
    </Button.List>
  );
}
