import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import {
  Icon,
  LinkWrapper,
  LinkWrapperProps,
  ScrollArea,
  ScrollBar,
} from "@sparkle/components/";
import { Button } from "@sparkle/components/Button";
import { MoreIcon } from "@sparkle/icons";
import { cn } from "@sparkle/lib/utils";

const listStyles = cva("s-flex", {
  variants: {
    layout: {
      container: "s-gap-1 s-relative s-flex-col s-overflow-hidden",
      item: cn(
        "s-box-border s-items-center s-w-full s-flex s-gap-1.5 s-cursor-pointer s-select-none s-items-center s-outline-none s-rounded-xl s-text-sm s-px-3 s-py-2 s-transition-colors s-duration-300",
        "data-[disabled]:s-pointer-events-none data-[disabled]:s-text-muted-foreground",
        "hover:s-text-foreground hover:s-bg-structure-150"
      ),
    },
    state: {
      active: "active:s-bg-structure-200",
      selected: "s-text-foreground s-font-medium s-bg-structure-150",
      unselected: "s-text-muted-foreground",
    },
  },
  defaultVariants: {
    layout: "container",
    state: "unselected",
  },
});

const labelStyles = cva(
  "s-font-semibold s-pt-6 s-pb-2 s-text-xs s-whitespace-nowrap s-overflow-hidden s-text-ellipsis"
);

const NavigationList = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    isScrolling?: boolean;
  }
>(({ className, children, isScrolling = false, ...props }, ref) =>
  !isScrolling ? (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={cn(listStyles({ layout: "container" }), className)}
      {...props}
    >
      {children}
    </div>
  ) : (
    <ScrollArea
      ref={ref}
      className={cn(listStyles({ layout: "container" }), className)}
      {...props}
    >
      {children}
      <ScrollBar />
    </ScrollArea>
  )
);
NavigationList.displayName = "NavigationList";

interface NavigationListItemProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Omit<LinkWrapperProps, "children" | "className"> {
  selected?: boolean;
  label?: string;
  icon?: React.ComponentType;
  moreMenu?: React.ReactNode;
}

const NavigationListItem = React.forwardRef<
  HTMLDivElement,
  NavigationListItemProps
>(
  (
    {
      className,
      selected,
      label,
      icon,
      href,
      target,
      rel,
      replace,
      shallow,
      moreMenu,
      ...props
    },
    ref
  ) => {
    const [isPressed, setIsPressed] = React.useState(false);

    const handleMouseDown = (event: React.MouseEvent) => {
      if (!(event.target as HTMLElement).closest(".button-class")) {
        setIsPressed(true);
      }
    };

    return (
      <div
        className={cn("s-group/menu-item s-relative", className)}
        ref={ref}
        data-nav="menu-button"
        data-selected={selected}
        {...props}
      >
        <LinkWrapper
          href={href}
          target={target}
          rel={rel}
          replace={replace}
          shallow={shallow}
        >
          <div
            className={cn(
              "s-peer/menu-button",
              listStyles({
                layout: "item",
                state: selected
                  ? "selected"
                  : isPressed
                    ? "active"
                    : "unselected",
              })
            )}
            onMouseLeave={() => {
              setIsPressed(false);
            }}
            onMouseDown={handleMouseDown}
            onMouseUp={() => setIsPressed(false)}
          >
            {icon && <Icon visual={icon} size="sm" />}
            {label && (
              <span className="s-grow s-overflow-hidden s-text-ellipsis s-whitespace-nowrap group-hover/menu-item:s-pr-8 group-data-[selected=true]/menu-item:s-pr-8">
                {label}
              </span>
            )}
          </div>
        </LinkWrapper>
        {moreMenu && <>{moreMenu}</>}
      </div>
    );
  }
);
NavigationListItem.displayName = "NavigationListItem";

interface NavigationListItemActionProps
  extends React.HTMLAttributes<HTMLDivElement> {
  showOnHover?: boolean;
}

const NavigationListItemAction = React.forwardRef<
  HTMLDivElement,
  NavigationListItemActionProps
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="menu-action"
      className={cn(
        "s-absolute s-right-1.5 s-top-1 s-opacity-0 s-transition-opacity",
        "s-opacity-0 group-focus-within/menu-item:s-opacity-100 group-hover/menu-item:s-opacity-100 group-data-[selected=true]/menu-item:s-opacity-100",
        className
      )}
      {...props}
    >
      <Button size="mini" icon={MoreIcon} variant="ghost" />
    </div>
  );
});
NavigationListItemAction.displayName = "NavigationListItemAction";

const variantStyles = cva("", {
  variants: {
    variant: {
      primary: "s-text-foreground",
      secondary: "s-text-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

interface NavigationListLabelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof variantStyles> {
  label: string;
  isSticky?: boolean;
}

const NavigationListLabel = React.forwardRef<
  HTMLDivElement,
  NavigationListLabelProps
>(({ className, variant, label, isSticky = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      labelStyles(),
      variantStyles({ variant }),
      isSticky &&
        "s-sticky s-top-0 s-z-50 s-border-b s-border-border-dark/80 s-bg-structure-100/90 s-backdrop-blur-sm",
      className
    )}
    {...props}
  >
    {label}
  </div>
));

NavigationListLabel.displayName = "NavigationListLabel";

export {
  NavigationList,
  NavigationListItem,
  NavigationListItemAction,
  NavigationListLabel,
};
