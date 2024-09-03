import { Button, Item, Page, Searchbar, ServerIcon } from "@dust-tt/sparkle";
import type {
  CoreAPITable,
  DataSourceViewType,
  WorkspaceType,
} from "@dust-tt/types";
import { Transition } from "@headlessui/react";
import * as React from "react";
import { useMemo, useState } from "react";

import type { AssistantBuilderTableConfiguration } from "@app/components/assistant_builder/types";
import { getConnectorProviderLogoWithFallback } from "@app/lib/connector_providers";
import { useTables } from "@app/lib/swr/tables";
import { compareForFuzzySort, subFilter } from "@app/lib/utils";

export const PickTableInFolder = ({
  owner,
  dataSourceView,
  onPick,
  onBack,
  tablesQueryConfiguration,
}: {
  owner: WorkspaceType;
  dataSourceView: DataSourceViewType;
  onPick: (table: CoreAPITable) => void;
  onBack?: () => void;
  tablesQueryConfiguration: Record<string, AssistantBuilderTableConfiguration>;
}) => {
  const { tables } = useTables({
    workspaceId: owner.sId,
    dataSourceName: dataSourceView.dataSource.name,
  });
  const [query, setQuery] = useState<string>("");

  const tablesToDisplay = tables.filter(
    (t) =>
      !tablesQueryConfiguration?.[
        `${owner.sId}/${dataSourceView.dataSource.name}/${t.table_id}`
      ]
  );
  const filtered = useMemo(
    () =>
      tablesToDisplay.filter((t) => {
        return subFilter(query.toLowerCase(), t.name.toLowerCase());
      }),
    [query, tablesToDisplay]
  );

  const isAllSelected = !!tables.length && !tablesToDisplay.length;

  return (
    <Transition show className="mx-auto max-w-6xl">
      <Page>
        <Page.Header title="Select a Table" icon={ServerIcon} />
        {isAllSelected && (
          <div className="flex h-full w-full flex-col">
            <div className="text-gray-500">
              All tables from this DataSource are already selected.
            </div>
          </div>
        )}

        {tables.length === 0 && (
          <div className="flex h-full w-full flex-col">
            <div className="text-gray-500">
              No tables found in this Data Source.
            </div>
          </div>
        )}

        {!!tablesToDisplay.length && (
          <>
            <Searchbar
              name="search"
              onChange={setQuery}
              value={query}
              placeholder="Search..."
            />
            {filtered
              .sort((a, b) => compareForFuzzySort(query, a.name, b.name))
              .map((table) => {
                return (
                  <Item.Navigation
                    label={table.name}
                    icon={getConnectorProviderLogoWithFallback(
                      dataSourceView.dataSource.connectorProvider,
                      ServerIcon
                    )}
                    key={`${table.data_source_id}/${table.table_id}`}
                    onClick={() => {
                      onPick(table);
                    }}
                  />
                );
              })}
          </>
        )}

        <div className="flex pt-8">
          <Button label="Back" onClick={onBack} variant="secondary" />
        </div>
      </Page>
    </Transition>
  );
};
