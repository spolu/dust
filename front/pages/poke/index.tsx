import { Spinner } from "@dust-tt/sparkle";
import Link from "next/link";
import type { ChangeEvent } from "react";
import React, { useState } from "react";

import PokeNavbar from "@app/components/poke/PokeNavbar";
import {
  PokeTable,
  PokeTableBody,
  PokeTableCell,
  PokeTableRow,
} from "@app/components/poke/shadcn/ui/table";
import { withSuperUserAuthRequirements } from "@app/lib/iam/session";
import { usePokeWorkspaces } from "@app/lib/swr";
import type { PokeWorkspaceType } from "@app/pages/api/poke/workspaces";

const limit: number = 12;

export const getServerSideProps = withSuperUserAuthRequirements<object>(
  async () => {
    return {
      props: {},
    };
  }
);

const renderWorkspaces = (title: string, workspaces: PokeWorkspaceType[]) => (
  <>
    <h1 className="mb-4 mt-8 text-2xl font-bold">{title}</h1>
    <ul className="flex flex-wrap gap-4">
      {workspaces.length === 0 && <p>No workspaces found.</p>}
      {workspaces.map((ws) => (
        <Link href={`/poke/${ws.sId}`} key={ws.id}>
          <li className="border-material-100 s-w-[320px] rounded-lg border bg-white p-4 transition-colors duration-200 hover:bg-gray-100">
            <h2 className="text-md flex-grow pb-4 font-bold">{ws.name}</h2>
            <PokeTable>
              <PokeTableBody>
                <PokeTableRow>
                  <PokeTableCell>
                    {ws.adminEmail}{" "}
                    {ws.workspaceDomain && (
                      <label>({ws.workspaceDomain.domain})</label>
                    )}
                  </PokeTableCell>
                  <PokeTableCell>
                    {ws.membersCount && ws.membersCount > 1 ? (
                      <label>{ws.membersCount} members</label>
                    ) : (
                      <label>{ws.membersCount} member</label>
                    )}
                  </PokeTableCell>
                </PokeTableRow>
                <PokeTableRow>
                  <PokeTableCell className="space-x-2">
                    <label className="rounded bg-green-500 px-1 text-sm text-white">
                      {ws.sId}
                    </label>
                    {ws.subscription && (
                      <label
                        className={`rounded px-1 text-sm text-gray-500 text-white ${ws.subscription.plan.code.startsWith("ENT_") ? "bg-red-500" : "bg-blue-500"}`}
                      >
                        {ws.subscription.plan.name}
                      </label>
                    )}
                  </PokeTableCell>
                </PokeTableRow>
              </PokeTableBody>
            </PokeTable>
          </li>
        </Link>
      ))}
    </ul>
  </>
);

const Dashboard = () => {
  const {
    workspaces: upgradedWorkspaces,
    isWorkspacesLoading: isUpgradedWorkspacesLoading,
    isWorkspacesError: isUpgradedWorkspacesError,
  } = usePokeWorkspaces({ upgraded: true, limit });

  const [searchTerm, setSearchTerm] = useState("");

  const searchDisabled = searchTerm.trim().length < 3;

  const {
    workspaces: searchResults,
    isWorkspacesLoading: isSearchResultsLoading,
    isWorkspacesError: isSearchResultsError,
  } = usePokeWorkspaces({
    search: searchTerm,
    disabled: searchDisabled,
    limit,
  });

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  return (
    <div className="min-h-screen bg-structure-50">
      <PokeNavbar />
      <div className="flex-grow p-6">
        <>
          <h1 className="mb-4 text-2xl font-bold">Search in Workspaces</h1>
          <input
            className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          {isSearchResultsError && (
            <p>An error occurred while fetching search results.</p>
          )}
          {!isSearchResultsLoading &&
            !isSearchResultsError &&
            renderWorkspaces("Search Results", searchResults)}
          {isSearchResultsLoading && !searchDisabled && (
            <Spinner size="xl" variant="color" />
          )}
          {!isUpgradedWorkspacesLoading &&
            !isUpgradedWorkspacesError &&
            renderWorkspaces(
              `Last ${limit} Upgraded Workspaces`,
              upgradedWorkspaces
            )}
          {isUpgradedWorkspacesLoading && <Spinner size="xl" variant="color" />}
        </>
      </div>
    </div>
  );
};

export default Dashboard;
