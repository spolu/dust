import { Spinner } from "@dust-tt/sparkle";
import type { PluginWorkspaceResource } from "@dust-tt/types";
import { AlertCircle } from "lucide-react";
import { useCallback, useState } from "react";

import { PluginForm } from "@app/components/poke/plugins/PluginForm";
import {
  PokeAlert,
  PokeAlertDescription,
  PokeAlertTitle,
} from "@app/components/poke/shadcn/ui/alert";
import {
  PokeDialog,
  PokeDialogContent,
} from "@app/components/poke/shadcn/ui/dialog";
import type { PluginListItem } from "@app/lib/api/poke/types";
import { usePokePluginManifest, useRunPokePlugin } from "@app/poke/swr/plugins";

type ExecutePluginDialogProps = {
  onClose: () => void;
  plugin: PluginListItem;
  workspaceResource?: PluginWorkspaceResource;
};

export function RunPluginDialog({
  onClose,
  plugin,
  workspaceResource,
}: ExecutePluginDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const { isLoading, manifest } = usePokePluginManifest({
    disabled: !open,
    pluginId: plugin?.id,
    workspaceResource,
  });

  const { doRunPlugin } = useRunPokePlugin({
    pluginId: plugin.id,
    workspaceResource,
  });

  const handleClose = () => {
    setError(null);
    setResult(null);
    onClose();
  };

  const onSubmit = useCallback(
    async (args: object) => {
      setError(null);
      setResult(null);

      const runRes = await doRunPlugin(args);
      if (runRes.isErr()) {
        setError(runRes.error);
      } else {
        setResult(runRes.value);
      }
    },
    [doRunPlugin]
  );

  return (
    <PokeDialog open={true} onOpenChange={handleClose}>
      <PokeDialogContent className="bg-structure-50 sm:max-w-[600px]">
        {isLoading ? (
          <Spinner />
        ) : !manifest ? (
          <PokeAlert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <PokeAlertTitle>Error</PokeAlertTitle>
            <PokeAlertDescription>
              Your session has expired. Please log in again.
            </PokeAlertDescription>
          </PokeAlert>
        ) : (
          <>
            {error && (
              <PokeAlert variant="destructive">
                <PokeAlertTitle>Error</PokeAlertTitle>
                <PokeAlertDescription>{error}</PokeAlertDescription>
              </PokeAlert>
            )}
            {result && (
              <PokeAlert variant="default">
                <PokeAlertTitle>Success</PokeAlertTitle>
                <PokeAlertDescription>{result}</PokeAlertDescription>
              </PokeAlert>
            )}
            <PluginForm manifest={manifest} onSubmit={onSubmit} />
          </>
        )}
      </PokeDialogContent>
    </PokeDialog>
  );
}
