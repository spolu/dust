import React from "react";

import { User } from "@sparkle/icons/solid";
import { classNames } from "@sparkle/lib/utils";

type AvatarProps = {
  size: "xs" | "sm" | "md" | "lg" | "xl" | "auto";
  name?: string;
  visual?: string | React.ReactNode;
  onClick?: () => void;
  busy?: boolean;
  isRounded?: boolean;
};

const colors = [
  "s-bg-red-300",
  "s-bg-orange-300",
  "s-bg-amber-300",
  "s-bg-yellow-300",
  "s-bg-lime-300",
  "s-bg-green-300",
  "s-bg-emerald-300",
  "s-bg-teal-300",
  "s-bg-cyan-300",
  "s-bg-sky-300",
  "s-bg-blue-300",
  "s-bg-indigo-300",
  "s-bg-violet-300",
  "s-bg-purple-300",
  "s-bg-fuchsia-300",
  "s-bg-rose-300",
];

const txtColors = [
  "s-text-red-700",
  "s-text-orange-700",
  "s-text-amber-700",
  "s-text-yellow-700",
  "s-text-lime-700",
  "s-text-green-700",
  "s-text-emerald-700",
  "s-text-teal-700",
  "s-text-cyan-700",
  "s-text-sky-700",
  "s-text-blue-700",
  "s-text-indigo-700",
  "s-text-violet-700",
  "s-text-purple-700",
  "s-text-fuchsia-700",
  "s-text-rose-700",
];

const sizeClasses = {
  xs: "s-h-6 s-w-6",
  sm: "s-h-8 s-w-8",
  md: "s-h-10 s-w-10",
  lg: "s-h-16 s-w-16",
  xl: "s-h-36 s-w-36",
  auto: "s-w-full s-relative",
};

const roundedClasses = {
  xs: "s-rounded-full",
  sm: "s-rounded-lg",
  md: "s-rounded-xl",
  lg: "s-rounded-2xl",
  xl: "s-rounded-3xl",
  auto: "s-rounded-[25%]",
};

const textSize = {
  xs: "s-text-xs",
  sm: "s-text-sm",
  md: "s-text-base",
  lg: "s-text-3xl",
  xl: "s-text-7xl",
  auto: "s-text-xl",
};

export function Avatar({
  size = "md",
  name,
  visual,
  onClick,
  busy = false,
  isRounded = false,
}: AvatarProps) {
  const getColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getTextVariant = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return txtColors[Math.abs(hash) % txtColors.length];
  };

  const clickableStyles =
    onClick && !busy
      ? "s-cursor-pointer hover:s-filter hover:s-brightness-110 active:s-brightness-90 s-transition s-duration-200 s-ease-out"
      : "";

  const busyStyles = busy ? "s-animate-breathing s-cursor-default" : "";

  const avatarClass = classNames(
    sizeClasses[size],
    isRounded ? "s-rounded-full" : roundedClasses[size],
    name ? getColor(name) : "s-bg-slate-200",
    "s-flex s-flex-shrink-0 s-items-center s-justify-center s-overflow-hidden",
    clickableStyles,
    busyStyles
  );

  return (
    <div className={avatarClass}>
      {size === "auto" && <div style={{ paddingBottom: "100%" }} />}
      {typeof visual === "string" ? (
        <img
          src={visual}
          alt={name}
          className={classNames(
            sizeClasses[size],
            "s-h-full s-w-full s-object-cover s-object-center"
          )}
        />
      ) : visual ? (
        visual
      ) : name ? (
        <span
          className={classNames(
            getTextVariant(name),
            textSize[size],
            "s-select-none s-font-medium"
          )}
        >
          {name[0].toUpperCase()}
        </span>
      ) : (
        <User className="s-h-1/2 s-w-1/2 s-opacity-20" /> // Default icon with size and slate-900 color
      )}
    </div>
  );
}
