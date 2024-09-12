import {
  Button,
  DataTable,
  Icon,
  Input,
  Modal,
  Page,
  PlusIcon,
  Searchbar,
  Spinner,
} from "@dust-tt/sparkle";
import type { LightWorkspaceType, UserType, VaultType } from "@dust-tt/types";
import { InformationCircleIcon } from "@heroicons/react/20/solid";
import type { CellContext, PaginationState, Row } from "@tanstack/react-table";
import { MinusIcon } from "lucide-react";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmDeleteVaultDialog } from "@app/components/vaults/ConfirmDeleteVaultDialog";
import { useSearchMembers } from "@app/lib/swr/user";
import {
  useCreateVault,
  useDeleteVault,
  useUpdateVault,
  useVaultInfo,
} from "@app/lib/swr/vaults";
import { removeDiacritics } from "@app/lib/utils";

type RowData = {
  icon: string;
  name: string;
  userId: string;
  email: string;
  onClick?: () => void;
};

type Info = CellContext<RowData, unknown>;

interface CreateOrEditVaultModalProps {
  owner: LightWorkspaceType;
  isOpen: boolean;
  onClose: () => void;
  vault?: VaultType;
}

function getTableRows(allUsers: UserType[]): RowData[] {
  return allUsers.map((user) => ({
    icon: user.image ?? "",
    name: user.fullName,
    userId: user.sId,
    email: user.email ?? "",
  }));
}

export function CreateOrEditVaultModal({
  owner,
  isOpen,
  onClose,
  vault,
}: CreateOrEditVaultModalProps) {
  const [vaultName, setVaultName] = useState<string | null>(
    vault?.name ?? null
  );
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const doCreate = useCreateVault({ owner });
  const doUpdate = useUpdateVault({ owner });
  const doDelete = useDeleteVault({ owner });

  const router = useRouter();

  const { vaultInfo } = useVaultInfo({
    workspaceId: owner.sId,
    vaultId: vault?.sId ?? null,
  });
  const vaultMembers = vaultInfo?.members ?? null;

  useEffect(() => {
    if (vaultMembers) {
      setSelectedMembers(vaultMembers.map((vm) => vm.sId));
      setVaultName(vault?.name ?? null);
    }
  }, [vault?.name, vaultMembers]);

  const { members, totalMembersCount, isLoading } = useSearchMembers(
    owner.sId,
    searchTerm,
    pagination.pageIndex,
    pagination.pageSize
  );

  console.log(members);

  const getTableColumns = useCallback(() => {
    return [
      {
        id: "name",
        accessorKey: "name",
        cell: (info: Info) => (
          <DataTable.CellContent avatarUrl={info.row.original.icon}>
            {info.row.original.name}
          </DataTable.CellContent>
        ),
        enableSorting: false,
        filterFn: (row: Row<RowData>, columnId: string, filterValue: any) => {
          if (!filterValue) {
            return true;
          }

          return removeDiacritics(row.getValue(columnId))
            .toLowerCase()
            .includes(removeDiacritics(filterValue).toLowerCase());
        },
      },
      {
        id: "email",
        accessorKey: "email",
        cell: (info: Info) => (
          <DataTable.CellContent>
            <span className="text-element-700">{info.row.original.email}</span>
          </DataTable.CellContent>
        ),
        enableSorting: false,
      },
      {
        id: "action",
        meta: {
          width: "10rem",
        },
        cell: (info: Info) => {
          const isSelected = selectedMembers.includes(info.row.original.userId);
          if (isSelected) {
            return (
              <div className="ml-4 flex w-full justify-end pr-2">
                <Button
                  label="Remove"
                  onClick={() =>
                    setSelectedMembers(
                      selectedMembers.filter(
                        (m) => m !== info.row.original.userId
                      )
                    )
                  }
                  variant="tertiary"
                  size="sm"
                  icon={MinusIcon}
                />
              </div>
            );
          }
          return (
            <div className="ml-4 flex w-full justify-end pr-2">
              <Button
                label="Add"
                onClick={() =>
                  setSelectedMembers([
                    ...selectedMembers,
                    info.row.original.userId,
                  ])
                }
                variant="secondary"
                size="sm"
                icon={PlusIcon}
              />
            </div>
          );
        },
      },
    ];
  }, [selectedMembers]);

  const rows = useMemo(() => getTableRows(members), [members]);

  const columns = useMemo(() => getTableColumns(), [getTableColumns]);

  const onSave = useCallback(async () => {
    setIsSaving(true);

    if (selectedMembers.length > 0 && vault) {
      await doUpdate(vault, selectedMembers);
    } else if (!vault) {
      const createdVault = await doCreate(vaultName, selectedMembers);
      if (createdVault) {
        await router.push(`/w/${owner.sId}/vaults/${createdVault.sId}`);
      }
    }
    setIsSaving(false);
    onClose();
  }, [
    doCreate,
    doUpdate,
    onClose,
    owner.sId,
    router,
    selectedMembers,
    vault,
    vaultName,
  ]);

  const onDelete = useCallback(async () => {
    if (!vault) {
      return;
    }

    const res = await doDelete(vault);
    if (res) {
      onClose();
      await router.push(`/w/${owner.sId}/vaults`);
    }
  }, [doDelete, onClose, owner.sId, router, vault]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={vault ? `Edit ${vault.name}` : "Create a Vault"}
      saveLabel={vault ? "Save" : "Create"}
      variant="side-md"
      hasChanged={!!vaultName && selectedMembers.length > 0}
      isSaving={isSaving}
      className="flex overflow-visible" // overflow-visible is needed to avoid clipping the delete button
      onSave={onSave}
    >
      <Page.Vertical gap="md" sizing="grow">
        <div className="flex w-full flex-col gap-y-4">
          <div className="mb-4 flex w-full flex-col gap-y-2 pt-2">
            <Page.SectionHeader title="Name" />
            <Input
              placeholder="Vault's name"
              value={vaultName}
              name="vaultName"
              className={vault ? "text-gray-300 hover:cursor-not-allowed" : ""}
              size="sm"
              onChange={(value) => setVaultName(value)}
              disabled={!!vault}
            />
            {!vault && (
              <div className="flex gap-1 text-xs text-element-700">
                <Icon visual={InformationCircleIcon} size="xs" />
                <span>Vault name must be unique</span>
              </div>
            )}
          </div>
          <div className="flex w-full grow flex-col gap-y-2 border-t pt-2">
            <Page.SectionHeader title="Vault members" />
            <div className="flex w-full">
              <Searchbar
                name="search"
                placeholder="Search members (email)"
                value={searchTerm}
                onChange={setSearchTerm}
              />
            </div>
            {isLoading ? (
              <div className="mt-8 flex justify-center">
                <Spinner size="lg" variant="color" />
              </div>
            ) : (
              <div className="flex grow flex-col overflow-y-auto">
                <DataTable
                  data={rows}
                  columns={columns}
                  pagination={pagination}
                  setPagination={setPagination}
                  totalRowCount={totalMembersCount}
                />
              </div>
            )}
          </div>
          {vault && vault.kind === "regular" && (
            <>
              <Page.Separator />
              <ConfirmDeleteVaultDialog
                vault={vault}
                handleDelete={onDelete}
                isOpen={showDeleteConfirmDialog}
                onClose={() => setShowDeleteConfirmDialog(false)}
              />
              <div className="flex w-full justify-end">
                <Button
                  size="sm"
                  label="Delete Vault"
                  variant="primaryWarning"
                  onClick={() => setShowDeleteConfirmDialog(true)}
                />
              </div>
            </>
          )}
        </div>
      </Page.Vertical>
    </Modal>
  );
}
