import React, {
  createContext,
  ReactNode,
  useContext,
  useState,
  useEffect,
} from "react";

import { ChevronDownIcon, ChevronUpIcon } from "@sparkle/index";

import { Icon } from "./Icon";

interface TableContextType {
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
  sortableColumns: Set<string>;
  registerSortableColumn: (column: string) => void;
}

const TableContext = createContext<TableContextType | null>(null);

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  children: ReactNode;
}

interface HeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

const TableRoot: React.FC<TableProps> = ({ children, className, ...props }) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [sortableColumns, setSortableColumns] = useState<Set<string>>(
    new Set()
  );

  const handleSort = (column: string) => {
    if (sortableColumns.has(column)) {
      if (sortColumn === column) {
        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      } else {
        setSortColumn(column);
        setSortDirection("asc");
      }
    }
  };

  const registerSortableColumn = (column: string) => {
    setSortableColumns((prev) => new Set(prev).add(column));
  };

  const contextValue: TableContextType = {
    sortColumn,
    sortDirection,
    onSort: handleSort,
    sortableColumns,
    registerSortableColumn,
  };

  return (
    <TableContext.Provider value={contextValue}>
      <table
        className={`s-w-full s-table-auto s-border-collapse ${className || ""}`}
        {...props}
      >
        {children}
      </table>
    </TableContext.Provider>
  );
};

interface HeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

const Header: React.FC<HeaderProps> = ({ children, className, ...props }) => (
  <thead
    className={`s-border-b s-border-structure-200 s-bg-structure-50 ${className || ""}`}
    {...props}
  >
    {children}
  </thead>
);

interface HeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  column: string;
  sortable?: boolean;
  children: ReactNode;
}

const Head: React.FC<HeadProps> = ({
  children,
  className,
  column,
  sortable = true,
  ...props
}) => {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error("Table.Head must be used within a Table");
  }
  const { sortColumn, sortDirection, onSort, registerSortableColumn } = context;

  useEffect(() => {
    if (sortable) {
      registerSortableColumn(column);
    }
  }, [sortable, registerSortableColumn, column]);

  return (
    <th
      className={`s-px-4 s-py-2 s-text-left s-font-medium s-text-element-700 ${sortable ? "s-cursor-pointer" : ""} ${className || ""}`}
      onClick={() => sortable && onSort(column)}
      {...props}
    >
      <div className="s-flex s-items-center s-space-x-1">
        <span>{children}</span>
        {sortable && (
          <Icon
            visual={
              sortColumn === column
                ? sortDirection === "asc"
                  ? ChevronUpIcon
                  : ChevronDownIcon
                : ChevronDownIcon
            }
            className="s-h-4 s-w-4 s-text-element-500"
          />
        )}
      </div>
    </th>
  );
};

const Body: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className,
  ...props
}) => (
  <tbody className={className} {...props}>
    {children}
  </tbody>
);

const Footer: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className,
  ...props
}) => (
  <tfoot
    className={`s-border-t s-border-structure-200 s-bg-structure-50 ${className || ""}`}
    {...props}
  >
    {children}
  </tfoot>
);

const Row: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  children,
  className,
  ...props
}) => (
  <tr
    className={`s-hover:bg-structure-50 s-border-b s-border-structure-200 ${className || ""}`}
    {...props}
  >
    {children}
  </tr>
);

const Cell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className,
  ...props
}) => (
  <td
    className={`s-px-4 s-py-2 s-text-element-800 ${className || ""}`}
    {...props}
  >
    {children}
  </td>
);

const Caption: React.FC<React.HTMLAttributes<HTMLTableCaptionElement>> = ({
  children,
  className,
  ...props
}) => (
  <caption
    className={`s-mt-4 s-text-sm s-text-element-600 ${className || ""}`}
    {...props}
  >
    {children}
  </caption>
);

export const Table = Object.assign(TableRoot, {
  Header,
  Body,
  Footer,
  Head,
  Row,
  Cell,
  Caption,
});
