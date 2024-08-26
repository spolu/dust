import {
  BracesIcon,
  Button,
  ExternalLinkIcon,
  FolderIcon,
  IconButton,
  Tree,
} from "@dust-tt/sparkle";
import type { DataSourceViewType, WorkspaceType } from "@dust-tt/types";
import { useContext, useState } from "react";

import { AssistantBuilderContext } from "@app/components/assistant_builder/AssistantBuilderContext";
import type { AssistantBuilderDataSourceConfiguration } from "@app/components/assistant_builder/types";
import { PermissionTreeChildren } from "@app/components/ConnectorPermissionsTree";
import { EmptyCallToAction } from "@app/components/EmptyCallToAction";
import ManagedDataSourceDocumentModal from "@app/components/ManagedDataSourceDocumentModal";
import {
  getConnectorProviderLogo,
  getConnectorProviderLogoWithFallback,
} from "@app/lib/connector_providers";
import { getVisualForContentNode } from "@app/lib/content_nodes";
import { getDisplayNameForDataSource } from "@app/lib/data_sources";
import { useConnectorPermissions } from "@app/lib/swr";
import { classNames } from "@app/lib/utils";

export default function DataSourceSelectionSection({
  owner,
  dataSourceConfigurations,
  openDataSourceModal,
}: {
  owner: WorkspaceType;
  dataSourceConfigurations: Record<
    string,
    AssistantBuilderDataSourceConfiguration
  >;
  openDataSourceModal: () => void;
  onDelete?: (name: string) => void;
}) {
  const { dataSourceViews } = useContext(AssistantBuilderContext);
  const [documentToDisplay, setDocumentToDisplay] = useState<string | null>(
    null
  );
  const [dataSourceViewToDisplay, setDataSourceViewToDisplay] =
    useState<DataSourceViewType | null>(null);

  const canAddDataSource = dataSourceViews.length > 0;

  return (
    <>
      <ManagedDataSourceDocumentModal
        owner={owner}
        dataSource={dataSourceViewToDisplay?.dataSource ?? null}
        documentId={documentToDisplay}
        isOpen={!!documentToDisplay}
        setOpen={(open) => {
          if (!open) {
            setDocumentToDisplay(null);
          }
        }}
      />

      <div className="overflow-hidden pt-4">
        <div className="flex flex-row items-start">
          <div className="flex-grow pb-2 text-sm font-semibold text-element-900">
            Selected Data sources
          </div>
          <div>
            {Object.keys(dataSourceConfigurations).length > 0 && (
              <Button
                labelVisible={true}
                label="Manage selection"
                variant="primary"
                size="sm"
                onClick={openDataSourceModal}
                disabled={!canAddDataSource}
                hasMagnifying={false}
              />
            )}
          </div>
        </div>
        {!Object.keys(dataSourceConfigurations).length ? (
          <EmptyCallToAction
            label="Select Data Sources"
            onClick={openDataSourceModal}
            disabled={!canAddDataSource}
          />
        ) : (
          <Tree>
            {Object.values(dataSourceConfigurations).map((dsConfig) => {
              const LogoComponent = getConnectorProviderLogoWithFallback(
                dsConfig.dataSourceView.dataSource.connectorProvider,
                FolderIcon
              );
              return (
                <Tree.Item
                  key={dsConfig.dataSourceView.sId}
                  type={
                    dsConfig.dataSourceView.dataSource.connectorId
                      ? "node"
                      : "leaf"
                  } // todo make useConnectorPermissions hook work for non managed ds (Folders)
                  label={getDisplayNameForDataSource(
                    dsConfig.dataSourceView.dataSource
                  )}
                  visual={LogoComponent}
                  className="whitespace-nowrap"
                >
                  {dsConfig.isSelectAll && (
                    <PermissionTreeChildren
                      owner={owner}
                      dataSource={dsConfig.dataSourceView.dataSource}
                      parentId={null}
                      permissionFilter="read"
                      canUpdatePermissions={true}
                      displayDocumentSource={(documentId: string) => {
                        setDataSourceViewToDisplay(dsConfig.dataSourceView);
                        setDocumentToDisplay(documentId);
                      }}
                      useConnectorPermissionsHook={useConnectorPermissions}
                      isSearchEnabled={false}
                    />
                  )}
                  {dsConfig.selectedResources.map((node) => {
                    return (
                      <Tree.Item
                        key={`${dsConfig.dataSourceView.sId}-${node.internalId}`}
                        label={node.titleWithParentsContext ?? node.title}
                        type={node.expandable ? "node" : "leaf"}
                        visual={getVisualForContentNode(node)}
                        className="whitespace-nowrap"
                        actions={
                          <div className="mr-8 flex flex-row gap-2">
                            <IconButton
                              size="xs"
                              icon={ExternalLinkIcon}
                              onClick={() => {
                                if (node.sourceUrl) {
                                  window.open(node.sourceUrl, "_blank");
                                }
                              }}
                              className={classNames(
                                node.sourceUrl
                                  ? ""
                                  : "pointer-events-none opacity-0"
                              )}
                              disabled={!node.sourceUrl}
                              variant="tertiary"
                            />
                            <IconButton
                              size="xs"
                              icon={BracesIcon}
                              onClick={() => {
                                if (node.dustDocumentId) {
                                  setDataSourceViewToDisplay(
                                    dsConfig.dataSourceView
                                  );
                                  setDocumentToDisplay(node.dustDocumentId);
                                }
                              }}
                              className={classNames(
                                node.dustDocumentId
                                  ? ""
                                  : "pointer-events-none opacity-0"
                              )}
                              disabled={!node.dustDocumentId}
                              variant="tertiary"
                            />
                          </div>
                        }
                      >
                        <PermissionTreeChildren
                          owner={owner}
                          dataSource={dsConfig.dataSourceView.dataSource}
                          parentId={node.internalId}
                          permissionFilter="read"
                          canUpdatePermissions={true}
                          displayDocumentSource={(documentId: string) => {
                            setDataSourceViewToDisplay(dsConfig.dataSourceView);
                            setDocumentToDisplay(documentId);
                          }}
                          useConnectorPermissionsHook={useConnectorPermissions}
                          isSearchEnabled={false}
                        />
                      </Tree.Item>
                    );
                  })}
                </Tree.Item>
              );
            })}
          </Tree>
        )}
      </div>
    </>
  );
}
