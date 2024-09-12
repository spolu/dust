import {
  Column,
  type ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  SortingFn,
  type SortingState,
  Updater,
  RowData,
  useReactTable,
} from "@tanstack/react-table";
import React, { ReactNode, useEffect, useState } from "react";

import { Avatar } from "@sparkle/components/Avatar";
import {
  DropdownItemProps,
  DropdownMenu,
} from "@sparkle/components/DropdownMenu";
import { IconButton } from "@sparkle/components/IconButton";
import { Pagination } from "@sparkle/components/Pagination";
import { Tooltip } from "@sparkle/components/Tooltip";
import { ArrowDownIcon, ArrowUpIcon, MoreIcon } from "@sparkle/icons";
import { classNames } from "@sparkle/lib/utils";

import { Icon } from "./Icon";
import { breakpoints, useWindowSize } from "./WindowUtility";

declare module "@tanstack/table-core" {
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
    grow?: boolean;
  }
}

interface TBaseData {
  onClick?: () => void;
  moreMenuItems?: DropdownItemProps[];
}

interface ColumnBreakpoint {
  [columnId: string]: "xs" | "sm" | "md" | "lg" | "xl";
}

interface DataTableProps<TData extends TBaseData> {
  data: TData[];
  totalRowCount?: number;
  columns: ColumnDef<TData, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  className?: string;
  widthClassName?: string;
  filter?: string;
  filterColumn?: string;
  pagination?: PaginationState;
  setPagination?: (pagination: PaginationState) => void;
  initialColumnOrder?: SortingState;
  columnsBreakpoints?: ColumnBreakpoint;
  sortingFn?: SortingFn<TData>;
}

function shouldRenderColumn(
  windowWidth: number,
  breakpoint?: keyof typeof breakpoints
): boolean {
  if (!breakpoint) {
    return true;
  }
  return windowWidth >= breakpoints[breakpoint];
}

export function DataTable<TData extends TBaseData>({
  data,
  totalRowCount,
  columns,
  className,
  widthClassName,
  filter,
  filterColumn,
  initialColumnOrder,
  columnsBreakpoints = {},
  pagination,
  setPagination,
}: DataTableProps<TData>) {
  const windowSize = useWindowSize();
  const [sorting, setSorting] = useState<SortingState>(
    initialColumnOrder ?? []
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const isServerSidePagination = !!totalRowCount && totalRowCount > data.length;
  const onPaginationChange =
    pagination && setPagination
      ? (updater: Updater<PaginationState>) => {
          const newValue =
            typeof updater === "function" ? updater(pagination) : updater;
          setPagination(newValue);
        }
      : undefined;

  const table = useReactTable({
    data,
    columns,
    rowCount: totalRowCount,
    manualPagination: isServerSidePagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
    onColumnFiltersChange: setColumnFilters,
    state: {
      columnFilters,
      sorting: isServerSidePagination ? undefined : sorting,
      pagination,
    },
    initialState: {
      pagination,
    },
    onPaginationChange: onPaginationChange,
  });

  useEffect(() => {
    if (filterColumn) {
      table.getColumn(filterColumn)?.setFilterValue(filter);
    }
  }, [filter, filterColumn]);

  return (
    <div
      className={classNames(
        "s-flex s-flex-col s-gap-2",
        className || "",
        widthClassName || ""
      )}
    >
      <DataTable.Root>
        <DataTable.Header>
          {table.getHeaderGroups().map((headerGroup) => (
            <DataTable.Row key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const breakpoint = columnsBreakpoints[header.id];
                if (
                  !windowSize.width ||
                  !shouldRenderColumn(windowSize.width, breakpoint)
                ) {
                  return null;
                }
                return (
                  <DataTable.Head
                    column={header.column}
                    widthClassName={widthClassName}
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={classNames(
                      header.column.getCanSort() ? "s-cursor-pointer" : ""
                    )}
                  >
                    <div className="s-flex s-items-center s-space-x-1 s-whitespace-nowrap">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getCanSort() && (
                        <Icon
                          visual={
                            header.column.getIsSorted() === "asc"
                              ? ArrowUpIcon
                              : header.column.getIsSorted() === "desc"
                                ? ArrowDownIcon
                                : ArrowDownIcon
                          }
                          size="xs"
                          className={classNames(
                            "s-ml-1",
                            header.column.getIsSorted()
                              ? "s-opacity-100"
                              : "s-opacity-0"
                          )}
                        />
                      )}
                    </div>
                  </DataTable.Head>
                );
              })}
            </DataTable.Row>
          ))}
        </DataTable.Header>
        <DataTable.Body>
          {table.getRowModel().rows.map((row) => (
            <DataTable.Row
              widthClassName={widthClassName}
              key={row.id}
              onClick={row.original.onClick}
              moreMenuItems={row.original.moreMenuItems}
            >
              {row.getVisibleCells().map((cell) => {
                const breakpoint = columnsBreakpoints[cell.column.id];
                if (
                  !windowSize.width ||
                  !shouldRenderColumn(windowSize.width, breakpoint)
                ) {
                  return null;
                }
                return (
                  <DataTable.Cell column={cell.column} key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </DataTable.Cell>
                );
              })}
            </DataTable.Row>
          ))}
        </DataTable.Body>
      </DataTable.Root>
      {pagination && (
        <div className="s-p-1">
          <Pagination
            pagination={table.getState().pagination}
            setPagination={table.setPagination}
            rowCount={table.getRowCount()}
          />
        </div>
      )}
    </div>
  );
}

interface DataTableRootProps extends React.HTMLAttributes<HTMLTableElement> {
  children: ReactNode;
}

DataTable.Root = function DataTableRoot({
  children,
  ...props
}: DataTableRootProps) {
  return (
    <table className="s-w-full s-border-collapse" {...props}>
      {children}
    </table>
  );
};

interface HeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

DataTable.Header = function Header({
  children,
  className,
  ...props
}: HeaderProps) {
  return (
    <thead
      className={classNames("s-text-xs s-capitalize", className || "")}
      {...props}
    >
      {children}
    </thead>
  );
};

interface HeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
  column: Column<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  widthClassName?: string;
}

DataTable.Head = function Head({
  children,
  className,
  column,
  widthClassName,
  ...props
}: HeadProps) {
  return (
    <th
      style={getSize(column.columnDef)}
      className={classNames(
        "s-py-1 s-pr-3 s-text-left s-font-medium s-text-element-800",
        widthClassName || "",
        className || ""
      )}
      {...props}
    >
      {children}
    </th>
  );
};

DataTable.Body = function Body({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
};

interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode;
  onClick?: () => void;
  moreMenuItems?: DropdownItemProps[];
  widthClassName?: string;
}

DataTable.Row = function Row({
  children,
  className,
  onClick,
  moreMenuItems,
  widthClassName,
  ...props
}: RowProps) {
  return (
    <tr
      className={classNames(
        "s-group/dt s-align-center s-flex s-border-b s-border-structure-200 s-text-sm s-transition-colors s-duration-300 s-ease-out",
        onClick ? "s-cursor-pointer hover:s-bg-structure-50" : "",
        widthClassName || "",
        className || ""
      )}
      onClick={onClick ? onClick : undefined}
      {...props}
    >
      {children}
      <td className="s-align-center s-flex s-w-8 s-cursor-pointer s-pl-1 s-text-element-600">
        {moreMenuItems && moreMenuItems.length > 0 && (
          <DropdownMenu className="s-mr-1.5 s-flex">
            <DropdownMenu.Button>
              <IconButton
                icon={MoreIcon}
                size="sm"
                variant="tertiary"
                className="s-m-1"
              />
            </DropdownMenu.Button>
            <DropdownMenu.Items origin="topRight" width={220}>
              {moreMenuItems?.map((item, index) => (
                <DropdownMenu.Item key={index} {...item} />
              ))}
            </DropdownMenu.Items>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
};

interface CellProps extends React.HTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
  column: Column<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

DataTable.Cell = function Cell({
  children,
  className,
  column,
  ...props
}: CellProps) {
  column.columnDef.minSize;
  return (
    <td
      style={getSize(column.columnDef)}
      className={classNames(
        "s-align-center s-flex s-h-12 s-max-w-sm s-truncate s-whitespace-nowrap s-pl-1.5 s-text-element-800",
        column.columnDef.meta?.className || "",
        className || ""
      )}
      {...props}
    >
      {children}
    </td>
  );
};

function getSize(columnDef: ColumnDef<any>) {
  if (columnDef.meta?.grow) {
    return { flex: 1 };
  }
  return {
    width: columnDef.size,
    minWidth: columnDef.minSize,
    maxWidth: columnDef.maxSize,
  };
}

interface CellContentProps extends React.TdHTMLAttributes<HTMLDivElement> {
  avatarUrl?: string;
  avatarTooltipLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  roundedAvatar?: boolean;
  children?: ReactNode;
  description?: string;
}

DataTable.CellContent = function CellContent({
  children,
  className,
  avatarUrl,
  avatarTooltipLabel,
  roundedAvatar,
  icon,
  iconClassName,
  description,
  ...props
}: CellContentProps) {
  return (
    <div
      className={classNames(
        "s-flex s-w-full s-items-center s-py-2",
        className || ""
      )}
      {...props}
    >
      {avatarUrl && avatarTooltipLabel && (
        <Tooltip label={avatarTooltipLabel} position="above">
          <Avatar
            visual={avatarUrl}
            size="xs"
            className="s-mr-2"
            isRounded={roundedAvatar ?? false}
          />
        </Tooltip>
      )}
      {avatarUrl && !avatarTooltipLabel && (
        <Avatar
          visual={avatarUrl}
          size="xs"
          className="s-mr-2"
          isRounded={roundedAvatar ?? false}
        />
      )}
      {icon && (
        <Icon
          visual={icon}
          size="sm"
          className={classNames(
            "s-mr-2 s-text-element-800",
            iconClassName || ""
          )}
        />
      )}
      <div className="s-flex s-shrink s-truncate">
        <span className="s-truncate s-text-sm s-text-element-800">
          {children}
        </span>
        {description && (
          <span className="s-pl-2 s-text-sm s-text-element-600">
            {description}
          </span>
        )}
      </div>
    </div>
  );
};

DataTable.Caption = function Caption({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption className={className} {...props}>
      {children}
    </caption>
  );
};
