import { Button, PlusIcon } from "@dust-tt/sparkle";
import Link from "next/link";
import React, { ComponentType, MouseEvent } from "react";

import { classNames } from "@app/lib/utils";

export function EmptyCallToAction({
  label,
  disabled = false,
  icon = PlusIcon,
  href,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  icon?: ComponentType;
  href?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const button = (
    <Button
      disabled={disabled}
      size="md"
      label={label}
      variant="primary"
      icon={icon}
      onClick={onClick}
    />
  );
  return (
    <div
      className={classNames(
        "relative flex h-full min-h-48 items-center justify-center rounded-lg bg-structure-50"
      )}
    >
      {href ? <Link href={href}>{button}</Link> : button}
    </div>
  );
}
