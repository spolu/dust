import {
  Dialog,
  Icon,
  RadioGroup,
  RadioGroupChoice,
  Separator,
} from "@dust-tt/sparkle";
import type { SpaceType } from "@dust-tt/types";
import React, { useState } from "react";

import { getSpaceIcon, getSpaceName, groupSpaces } from "@app/lib/spaces";
import { classNames } from "@app/lib/utils";

interface VaultSelectorProps {
  allowedSpaces?: SpaceType[];
  defaultSpace: string | undefined;
  vaults: SpaceType[];
  renderChildren: (vault?: SpaceType) => React.ReactNode;
}
export function VaultSelector({
  allowedSpaces,
  defaultSpace,
  renderChildren,
  vaults,
}: VaultSelectorProps) {
  const [selectedSpace, setSelectedSpace] = useState<string | undefined>(
    defaultSpace
  );
  const [isAlertDialogOpen, setAlertIsDialogOpen] = useState(false);

  const shouldRenderDirectly = vaults.length === 1;
  const selectedSpaceObj = vaults.find((v) => v.sId === selectedSpace);

  if (shouldRenderDirectly) {
    if (allowedSpaces && !allowedSpaces.some((v) => v.sId === vaults[0].sId)) {
      return renderChildren(undefined);
    }
    return renderChildren(vaults[0]);
  }

  // Group by kind and sort.
  const sortedSpaces = groupSpaces(vaults)
    .filter((i) => i.section !== "system")
    .map((i) =>
      i.spaces.sort((a, b) => {
        return a.name.localeCompare(b.name);
      })
    )
    .flat();

  return (
    <>
      <RadioGroup
        value={selectedSpace}
        onValueChange={(value) => setSelectedSpace(value)}
      >
        {sortedSpaces.map((space, index) => {
          const isDisabled =
            allowedSpaces && !allowedSpaces.some((v) => v.sId === space.sId);

          return (
            <React.Fragment key={space.sId}>
              {index > 0 && <Separator />}
              <div key={space.sId} className="py-2">
                <RadioGroupChoice
                  value={space.sId}
                  disabled={isDisabled}
                  iconPosition="start"
                  onClick={() => {
                    if (isDisabled) {
                      setAlertIsDialogOpen(true);
                    }
                  }}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1 pl-2">
                      <Icon
                        visual={getSpaceIcon(space)}
                        size="md"
                        className={classNames(
                          "inline-block flex-shrink-0 align-middle",
                          isDisabled ? "text-element-700" : ""
                        )}
                      />
                      <span
                        className={classNames(
                          "font-bold",
                          "align-middle",
                          isDisabled ? "text-element-700" : "text-element-900"
                        )}
                      >
                        {getSpaceName(space)}
                      </span>
                    </div>
                    {selectedSpace === space.sId && (
                      <div className="ml-4 mt-1">
                        {renderChildren(selectedSpaceObj)}
                      </div>
                    )}
                  </div>
                </RadioGroupChoice>
              </div>
            </React.Fragment>
          );
        })}
      </RadioGroup>
      <Separator />
      <Dialog
        alertDialog={true}
        isOpen={isAlertDialogOpen}
        onValidate={() => setAlertIsDialogOpen(false)}
        title="Changing source selection"
      >
        An assistant can access one source of data only. The other tools are
        using a different source.
      </Dialog>
    </>
  );
}
