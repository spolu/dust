import React, { ComponentType } from "react";

import { classNames } from "@sparkle/lib/utils";

export interface IconProps {
  visual?: ComponentType<{ className?: string }>;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

const IconSizes = {
  xs: "s-h-4 s-w-4",
  sm: "s-h-5 s-w-5",
  md: "s-h-6 s-w-6",
  lg: "s-h-8 s-w-8",
  xl: "s-h-12 s-w-12",
  "2xl": "s-h-20 s-w-20",
};

export function Icon({
  visual: IconComponent,
  size = "sm",
  className = "",
}: IconProps) {
  return IconComponent ? (
    <IconComponent
      className={classNames(
        className,
        "s-flex-shrink-0 s-shrink-0",
        IconSizes[size]
      )}
    />
  ) : null;
}
