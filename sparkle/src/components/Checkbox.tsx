import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cva, VariantProps } from "class-variance-authority";
import React from "react";

import { CheckIcon, DashIcon } from "@sparkle/icons/solid";
import { cn } from "@sparkle/lib/utils";

import { Icon } from "./Icon";
import { Label } from "./Label";

const checkboxStyles = cva(
  cn(
    "s-shrink-0 s-peer s-border s-border-primary-500 s-text-foreground",
    "data-[state=checked]:s-text-white data-[state=checked]:s-text-foreground",
    "focus-visible:s-ring-ring s-ring-offset-background focus-visible:s-outline-none focus-visible:s-ring-2 focus-visible:s-ring-offset-2",
    "disabled:s-cursor-not-allowed disabled:s-opacity-50"
  ),
  {
    variants: {
      isPartial: {
        false: "data-[state=checked]:s-bg-action-500",
        true: "data-[state=checked]:s-bg-element-700",
      },
      size: {
        xs: "s-h-4 s-w-4 s-rounded",
        sm: "s-h-5 s-w-5 s-rounded-md",
      },
    },
    defaultVariants: {
      size: "sm",
      isPartial: false,
    },
  }
);

interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxStyles> {
  isPartial?: boolean;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, size = "sm", isPartial = false, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(checkboxStyles({ isPartial, size }), className)}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="s-flex s-items-center s-justify-center s-text-current">
      <span className={cn(size === "xs" ? "-s-mt-px" : "")}>
        <Icon size="xs" visual={isPartial ? DashIcon : CheckIcon} />
      </span>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

interface CheckboxWithTextProps extends CheckboxProps {
  text: string;
}

function CheckboxWithText({ text, ...props }: CheckboxWithTextProps) {
  return (
    <div className="s-items-top s-flex s-items-center s-space-x-2">
      <Checkbox {...props} />
      <Label className="s-text-sm s-leading-none peer-disabled:s-cursor-not-allowed peer-disabled:s-opacity-70">
        {text}
      </Label>
    </div>
  );
}

interface CheckboxWithTextAndDescriptionProps extends CheckboxWithTextProps {
  description: string;
}

function CheckBoxWithTextAndDescription({
  text,
  description,
  ...props
}: CheckboxWithTextAndDescriptionProps) {
  return (
    <div className="s-items-top s-flex s-space-x-2">
      <Checkbox {...props} />
      <div className="s-grid s-gap-1.5 s-leading-none">
        <Label className="s-text-sm s-leading-none peer-disabled:s-cursor-not-allowed peer-disabled:s-opacity-70">
          {text}
        </Label>
        <p className="s-text-xs s-text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export { Checkbox, CheckboxWithText, CheckBoxWithTextAndDescription };
