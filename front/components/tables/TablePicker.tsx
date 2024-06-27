import type { WorkspaceType } from "@dust-tt/types";
import type { CoreAPITable } from "@dust-tt/types";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";

import { useTables } from "@app/lib/swr";
import { classNames } from "@app/lib/utils";

export default function TablePicker({
  owner,
  dataSource,
  currentTableId,
  readOnly,
  onTableUpdate,
}: {
  owner: WorkspaceType;
  dataSource: {
    workspace_id: string;
    data_source_id: string;
  };
  currentTableId?: string;
  readOnly: boolean;
  onTableUpdate: (table: CoreAPITable) => void;
}) {
  void owner;
  void dataSource;

  const { tables } = useTables({
    workspaceId: dataSource.workspace_id,
    dataSourceName: dataSource.data_source_id,
  });

  const currentTable = currentTableId
    ? tables.find((t) => t.table_id === currentTableId)
    : null;

  return (
    <div className="flex items-center">
      <div className="flex items-center">
        {readOnly ? (
          currentTable ? (
            <div className="text-sm font-bold text-action-500">
              {currentTable.name}
            </div>
          ) : (
            "No Table"
          )
        ) : (
          <Menu as="div" className="relative inline-block text-left">
            <div>
              <MenuButton
                className={classNames(
                  "inline-flex items-center rounded-md py-1 text-sm font-normal text-gray-700",
                  currentTable ? "px-0" : "border px-3",
                  readOnly
                    ? "border-white text-gray-300"
                    : "border-orange-400 text-gray-700",
                  "focus:outline-none focus:ring-0"
                )}
              >
                {currentTable ? (
                  <>
                    <div className="mr-1 text-sm font-bold text-action-500">
                      {currentTable.name}
                    </div>
                    <ChevronDownIcon className="mt-0.5 h-4 w-4 hover:text-gray-700" />
                  </>
                ) : tables && tables.length > 0 ? (
                  "Select Table"
                ) : (
                  "No Tables"
                )}
              </MenuButton>
            </div>

            {(tables || []).length > 0 ? (
              <MenuItems
                className={classNames(
                  "absolute z-10 mt-1 w-max origin-top-left rounded-md bg-white shadow-sm ring-1 ring-black ring-opacity-5 focus:outline-none",
                  currentTable ? "-left-4" : "left-1"
                )}
              >
                <div className="py-1">
                  {(tables || []).map((t) => {
                    return (
                      <MenuItem key={t.table_id}>
                        {({ focus }) => (
                          <span
                            className={classNames(
                              focus
                                ? "bg-gray-50 text-gray-900"
                                : "text-gray-700",
                              "block cursor-pointer px-4 py-2 text-sm"
                            )}
                            onClick={() => onTableUpdate(t)}
                          >
                            {t.name}
                          </span>
                        )}
                      </MenuItem>
                    );
                  })}
                </div>
              </MenuItems>
            ) : null}
          </Menu>
        )}
      </div>
    </div>
  );
}
