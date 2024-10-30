import {
  Button,
  Modal,
  NewDropdownMenu,
  NewDropdownMenuContent,
  NewDropdownMenuItem,
  NewDropdownMenuTrigger,
  PlusIcon,
  TextArea,
} from "@dust-tt/sparkle";
import { useSendNotification } from "@dust-tt/sparkle";
import type { DataSourceType, LightWorkspaceType } from "@dust-tt/types";
import * as _ from "lodash";
import { useEffect, useState } from "react";

import { getConnectorProviderLogoWithFallback } from "@app/lib/connector_providers";
import { getDisplayNameForDataSource, isManaged } from "@app/lib/data_sources";
import { sendRequestDataSourceEmail } from "@app/lib/email";
import logger from "@app/logger/logger";

interface RequestDataSourceModal {
  dataSources: DataSourceType[];
  owner: LightWorkspaceType;
}

export function RequestDataSourceModal({
  dataSources,
  owner,
}: RequestDataSourceModal) {
  const [showRequestDataSourceModal, setShowRequestDataSourceModal] =
    useState(false);

  const [selectedDataSource, setSelectedDataSource] =
    useState<DataSourceType | null>(null);

  const [message, setMessage] = useState("");
  const sendNotification = useSendNotification();

  useEffect(() => {
    if (dataSources.length === 1) {
      setSelectedDataSource(dataSources[0]);
    }
  }, [dataSources]);

  const onClose = () => {
    setShowRequestDataSourceModal(false);
    setMessage("");
    if (dataSources.length === 1) {
      setSelectedDataSource(dataSources[0]);
    }
  };

  return (
    <>
      <Button
        label="Request"
        icon={PlusIcon}
        onClick={() => setShowRequestDataSourceModal(true)}
      />

      <Modal
        isOpen={showRequestDataSourceModal}
        onClose={onClose}
        hasChanged={false}
        variant="side-md"
        title="Requesting Data sources"
      >
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-2">
            {dataSources.length === 0 && (
              <label className="block text-sm font-medium text-element-800">
                <p>
                  You have no connection set up. Ask an admin to set one up.
                </p>
              </label>
            )}
            {dataSources.length > 1 && (
              <>
                <label className="block text-sm font-medium text-element-800">
                  <p>Where are the requested Data hosted?</p>
                </label>
                <NewDropdownMenu>
                  <NewDropdownMenuTrigger asChild>
                    {selectedDataSource && isManaged(selectedDataSource) ? (
                      <Button
                        variant="outline"
                        label={getDisplayNameForDataSource(selectedDataSource)}
                        icon={getConnectorProviderLogoWithFallback(
                          selectedDataSource.connectorProvider
                        )}
                      />
                    ) : (
                      <Button
                        label="Pick your platform"
                        variant="outline"
                        size="sm"
                        isSelect
                      />
                    )}
                  </NewDropdownMenuTrigger>
                  <NewDropdownMenuContent>
                    {dataSources.map(
                      (dataSource) =>
                        dataSource.connectorProvider && (
                          <NewDropdownMenuItem
                            key={dataSource.sId}
                            label={getDisplayNameForDataSource(dataSource)}
                            onClick={() => setSelectedDataSource(dataSource)}
                            icon={getConnectorProviderLogoWithFallback(
                              dataSource.connectorProvider
                            )}
                          />
                        )
                    )}
                  </NewDropdownMenuContent>
                </NewDropdownMenu>
              </>
            )}
          </div>

          {selectedDataSource && (
            <div className="flex flex-col gap-2">
              <p className="mb-2 text-sm text-element-700">
                {_.capitalize(selectedDataSource.editedByUser?.fullName ?? "")}{" "}
                is the administrator for the{" "}
                {getDisplayNameForDataSource(selectedDataSource)} connection
                within Dust. Send an email to{" "}
                {_.capitalize(selectedDataSource.editedByUser?.fullName ?? "")},
                explaining your request.
              </p>
              <TextArea
                placeholder={`Hello ${selectedDataSource.editedByUser?.fullName},`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mb-2"
              />
              <div>
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
                      onClose();
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
