import {
  NewDialog,
  NewDialogContainer,
  NewDialogContent,
  NewDialogFooter,
  NewDialogHeader,
  NewDialogTitle,
  Spinner,
} from "@dust-tt/sparkle";
import type { DataSourceType, LightWorkspaceType } from "@dust-tt/types";
import { pluralize } from "@dust-tt/types";
import { useMemo, useState } from "react";

import { getDisplayNameForDataSource } from "@app/lib/data_sources";
import { useDataSourceUsage } from "@app/lib/swr/data_sources";

interface DeleteStaticDataSourceDialogProps {
  owner: LightWorkspaceType;
  dataSource: DataSourceType;
  handleDelete: () => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteStaticDataSourceDialog({
  owner,
  dataSource,
  handleDelete,
  isOpen,
  onClose,
}: DeleteStaticDataSourceDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { usage, isUsageLoading, isUsageError } = useDataSourceUsage({
    owner,
    dataSource,
  });

  const onDelete = async () => {
    setIsLoading(true);
    await handleDelete();
    setIsLoading(false);
    onClose();
  };
  const name = getDisplayNameForDataSource(dataSource);

  const message = useMemo(() => {
    if (isUsageLoading) {
      return "Checking usage...";
    }
    if (isUsageError) {
      return "Failed to check usage.";
    }
    if (!usage) {
      return "No usage data available.";
    }
    if (usage.totalAgentCount > 0) {
      return `${usage.totalAgentCount} assistants currently use "${name}": ${usage.publicAgentNames.join(", ")}${usage.privateAgentCount > 0 ? ` and ${usage.privateAgentCount} private agent${pluralize(usage.privateAgentCount)}.` : "."}.`;
    }
    return `No assistants are using "${name}".`;
  }, [isUsageLoading, isUsageError, usage, name]);

  return (
    <NewDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <NewDialogContent>
        <NewDialogHeader>
          <NewDialogTitle>Confirm deletion</NewDialogTitle>
        </NewDialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner variant="dark" size="md" />
          </div>
        ) : (
          <>
            <NewDialogContainer>
              {message}
              <b>Are you sure you want to delete ?</b>
            </NewDialogContainer>
            <NewDialogFooter
              leftButtonProps={{
                label: "Cancel",
                variant: "outline",
              }}
              rightButtonProps={{
                label: "Delete",
                variant: "warning",
                onClick: async () => {
                  void onDelete();
                },
              }}
            />
          </>
        )}
      </NewDialogContent>
    </NewDialog>
  );
}
