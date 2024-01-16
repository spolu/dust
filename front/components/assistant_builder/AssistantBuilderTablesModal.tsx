import {
  Button,
  CloudArrowDownIcon,
  Item,
  Modal,
  Page,
  ServerIcon,
} from "@dust-tt/sparkle";
import { CoreAPITable, DataSourceType } from "@dust-tt/types";
import { WorkspaceType } from "@dust-tt/types";
import { Transition } from "@headlessui/react";
import type * as React from "react";
import { useState } from "react";

import { AssistantBuilderTableConfiguration } from "@app/components/assistant_builder/AssistantBuilder";
import { CONNECTOR_CONFIGURATIONS } from "@app/lib/connector_providers";
import { useTables } from "@app/lib/swr";

export default function AssistantBuilderTablesModal({
  isOpen,
  setOpen,
  onSave,
  owner,
  dataSources,
}: {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onSave: (params: AssistantBuilderTableConfiguration) => void;
  owner: WorkspaceType;
  dataSources: DataSourceType[];
}) {
  const [selectedDataSource, setSelectedDataSource] =
    useState<DataSourceType | null>(null);

  const [selectedTable, setSelectedTable] =
    useState<AssistantBuilderTableConfiguration | null>(null);

  const onClose = () => {
    setOpen(false);
    setTimeout(() => {
      setSelectedDataSource(null);
      setSelectedTable(null);
    }, 200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onSave={() => {
        if (selectedTable) {
          onSave(selectedTable);
        }
      }}
      hasChanged={!!selectedTable}
      variant="full-screen"
      title="Select Tables"
    >
      <div className="w-full pt-12">
        {!selectedDataSource ? (
          <PickDataSource
            dataSources={dataSources}
            onPick={(ds: DataSourceType) => {
              setSelectedDataSource(ds);
            }}
          />
        ) : (
          <PickTable
            owner={owner}
            dataSource={selectedDataSource}
            onPick={(table: CoreAPITable) => {
              const config = {
                workspaceId: owner.sId,
                dataSourceId: table.data_source_id,
                tableId: table.table_id,
              };
              setSelectedTable(config);
              onSave(config);
              onClose();
            }}
            onBack={() => {
              setSelectedDataSource(null);
            }}
          />
        )}
      </div>
    </Modal>
  );
}

function PickDataSource({
  dataSources,
  onPick,
}: {
  dataSources: DataSourceType[];
  onPick: (dataSource: DataSourceType) => void;
}) {
  return (
    <Transition show={true} className="mx-auto max-w-6xl">
      <Page>
        <Page.Header
          title="Select a Table in your Data sources"
          icon={ServerIcon}
        />

        {dataSources
          .sort(
            (a, b) =>
              (b.connectorProvider ? 1 : 0) - (a.connectorProvider ? 1 : 0)
          )
          .map((ds) => {
            return (
              <Item.Navigation
                label={
                  ds.connectorProvider
                    ? CONNECTOR_CONFIGURATIONS[ds.connectorProvider].name
                    : ds.name
                }
                icon={
                  ds.connectorProvider
                    ? CONNECTOR_CONFIGURATIONS[ds.connectorProvider]
                        .logoComponent
                    : CloudArrowDownIcon
                }
                key={ds.id}
                onClick={() => {
                  onPick(ds);
                }}
              />
            );
          })}
      </Page>
    </Transition>
  );
}

const PickTable = ({
  owner,
  dataSource,
  onPick,
  onBack,
}: {
  owner: WorkspaceType;
  dataSource: DataSourceType;
  onPick: (table: CoreAPITable) => void;
  onBack?: () => void;
}) => {
  const { tables } = useTables({
    workspaceId: owner.sId,
    dataSourceName: dataSource.name,
  });

  return (
    <Transition show={true} className="mx-auto max-w-6xl">
      <Page>
        <Page.Header
          title="Select a Table in your Data Sources"
          icon={ServerIcon}
        />

        {tables.length === 0 && (
          <div className="flex h-full w-full flex-col">
            <div className=" text-gray-500">
              No tables found in this Data Source.
            </div>
          </div>
        )}

        {tables.length > 0 &&
          tables
            .sort((a, b) => (b.name ? 1 : 0) - (a.name ? 1 : 0))
            .map((table) => {
              return (
                <Item.Navigation
                  label={table.name}
                  icon={
                    dataSource.connectorProvider
                      ? CONNECTOR_CONFIGURATIONS[dataSource.connectorProvider]
                          .logoComponent
                      : ServerIcon
                  }
                  key={`${table.data_source_id}/${table.table_id}`}
                  onClick={() => {
                    onPick(table);
                  }}
                />
              );
            })}

        <div className="flex pt-8">
          <Button label="Back" onClick={onBack} variant="secondary" />
        </div>
      </Page>
    </Transition>
  );
};
