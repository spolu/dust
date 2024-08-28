import { Button, DropdownMenu, Modal, TextArea } from "@dust-tt/sparkle";
import type { DataSourceType, WorkspaceType } from "@dust-tt/types";
import React, { useContext, useState } from "react";

import { SendNotificationsContext } from "@app/components/sparkle/Notification";
import { CONNECTOR_CONFIGURATIONS } from "@app/lib/connector_providers";
import { sendRequestDataSourceEmail } from "@app/lib/email";
import logger from "@app/logger/logger";

interface RequestDataSourcesProps {
  isOpen: boolean;
  onClose: () => void;
  dataSources: DataSourceType[];
  owner: WorkspaceType;
}

export function RequestDataSourcesModal({
  isOpen,
  onClose,
  dataSources,
  owner,
}: RequestDataSourcesProps) {
  const [selectedDataSource, setSelectedDataSource] =
    useState<DataSourceType | null>(null);
  const [message, setMessage] = useState("");
  const sendNotification = useContext(SendNotificationsContext);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        setMessage("");
        setSelectedDataSource(null);
      }}
      hasChanged={false}
      variant="side-md"
      title="Requesting Data sources"
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-element-800">
            {dataSources.length ? (
              <p>Where are the requested Data hosted?</p>
            ) : (
              <p>You have no connection set up. Ask an admin to set one up.</p>
            )}
          </label>
          {!!dataSources.length && (
            <DropdownMenu>
              <DropdownMenu.Button>
                {selectedDataSource && selectedDataSource.connectorProvider ? (
                  <Button
                    variant="tertiary"
                    label={
                      CONNECTOR_CONFIGURATIONS[
                        selectedDataSource.connectorProvider
                      ].name
                    }
                    icon={
                      CONNECTOR_CONFIGURATIONS[
                        selectedDataSource.connectorProvider
                      ].logoComponent
                    }
                  />
                ) : (
                  <Button
                    label="Pick your platform"
                    variant="tertiary"
                    size="sm"
                    type="select"
                  />
                )}
              </DropdownMenu.Button>
              <DropdownMenu.Items width={180}>
                {dataSources.map(
                  (dataSource) =>
                    dataSource.connectorProvider && (
                      <DropdownMenu.Item
                        key={dataSource.name}
                        label={
                          CONNECTOR_CONFIGURATIONS[dataSource.connectorProvider]
                            .name
                        }
                        onClick={() => setSelectedDataSource(dataSource)}
                        icon={
                          CONNECTOR_CONFIGURATIONS[dataSource.connectorProvider]
                            .logoComponent
                        }
                      />
                    )
                )}
              </DropdownMenu.Items>
            </DropdownMenu>
          )}
        </div>

        {selectedDataSource && (
          <div>
            <p className="s-mb-2 s-text-sm s-text-element-700">
              The administrator for{" "}
              {selectedDataSource.connectorProvider &&
                CONNECTOR_CONFIGURATIONS[selectedDataSource.connectorProvider]
                  .name}{" "}
              is {selectedDataSource.editedByUser?.fullName}. Send an email to{" "}
              {selectedDataSource.editedByUser?.fullName}, explaining your
              request.
            </p>
            <TextArea
              placeholder={`Hello ${selectedDataSource.editedByUser?.fullName},`}
              value={message}
              onChange={setMessage}
              className="s-mb-2"
            />
            <Button
              label="Send"
              variant="primary"
              size="sm"
              onClick={async () => {
                const userToId = selectedDataSource?.editedByUser?.userId;
                if (!userToId || !selectedDataSource) {
                  sendNotification({
                    type: "error",
                    title: "Error sending email",
                    description:
                      "An unexpected error occurred while sending email.",
                  });
                } else {
                  try {
                    await sendRequestDataSourceEmail({
                      userTo: userToId,
                      emailMessage: message,
                      dataSourceName: selectedDataSource.name,
                      owner,
                    });
                    sendNotification({
                      type: "success",
                      title: "Email sent!",
                      description: `Your request was sent to ${selectedDataSource?.editedByUser?.fullName}.`,
                    });
                  } catch (e) {
                    sendNotification({
                      type: "error",
                      title: "Error sending email",
                      description:
                        "An unexpected error occurred while sending the request.",
                    });
                    logger.error(
                      {
                        userToId,
                        dataSourceName: selectedDataSource.name,
                        error: e,
                      },
                      "Error sending email"
                    );
                  }
                  setMessage("");
                  setSelectedDataSource(null);
                  onClose();
                }
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
