import { CommandLineIcon, Item, Modal, Page } from "@dust-tt/sparkle";
import type { AppType, LightWorkspaceType, VaultType } from "@dust-tt/types";
import { Transition } from "@headlessui/react";

import { VaultSelector } from "@app/components/assistant_builder/vaults/VaultSelector";

interface AssistantBuilderDustAppModalProps {
  allowedVaults: VaultType[];
  dustApps: AppType[];
  isOpen: boolean;
  onSave: (app: AppType) => void;
  owner: LightWorkspaceType;
  setOpen: (isOpen: boolean) => void;
}

export default function AssistantBuilderDustAppModal({
  allowedVaults,
  dustApps,
  isOpen,
  onSave,
  owner,
  setOpen,
}: AssistantBuilderDustAppModalProps) {
  const onClose = () => {
    setOpen(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hasChanged={false}
      variant="full-screen"
      title="Select Dust App"
    >
      <div className="w-full pt-12">
        <PickDustApp
          allowedVaults={allowedVaults}
          owner={owner}
          show={true}
          dustApps={dustApps}
          onPick={(app) => {
            onSave(app);
            onClose();
          }}
        />
      </div>
    </Modal>
  );
}

interface PickDustAppProps {
  allowedVaults: VaultType[];
  dustApps: AppType[];
  onPick: (app: AppType) => void;
  owner: LightWorkspaceType;
  show: boolean;
}

function PickDustApp({
  owner,
  allowedVaults,
  dustApps,
  show,
  onPick,
}: PickDustAppProps) {
  const hasSomeUnselectableApps = dustApps.some(
    (app) => !app.description || app.description.length === 0
  );

  // TODO: Refresh vault when removing the dust apps.

  return (
    <Transition show={show} className="mx-auto max-w-6xl">
      <Page>
        <Page.Header title="Select Dust App" icon={CommandLineIcon} />
        {hasSomeUnselectableApps && (
          <Page.P>
            Dust apps without a description are not selectable. To make a Dust
            App selectable, edit it and add a description.
          </Page.P>
        )}
        <VaultSelector
          owner={owner}
          allowedVaults={allowedVaults}
          defaultVault={allowedVaults[0].sId}
          renderChildren={(vault) => {
            const allowedDustApps = vault
              ? dustApps.filter((app) => app.vault.sId === vault.sId)
              : dustApps;

            if (allowedDustApps.length === 0) {
              return <>No Dust Apps available.</>;
            }

            return (
              <>
                {allowedDustApps.map((app) => (
                  <Item.Navigation
                    label={app.name}
                    icon={CommandLineIcon}
                    disabled={!app.description || app.description.length === 0}
                    key={app.sId}
                    onClick={() => {
                      onPick(app);
                    }}
                  />
                ))}
              </>
            );
          }}
        />
      </Page>
    </Transition>
  );
}
