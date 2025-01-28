import React from "react";

import { ScrollArea, ScrollBar } from "@sparkle/components";
import { cn } from "@sparkle/lib";

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  fixed?: boolean;
  noPadding?: boolean;
}

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  (
    { children, fixed = false, noPadding = false, className, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn([
          "s-mx-auto",
          "s-w-full",
          "s-bg-white dark:s-bg-structure-50-darkMode",
          "s-@container"
        ].join(" "), className)}
        {...props}
      >
        <ScrollArea className="s-h-full" hideScrollBar>
          <div
            className={cn({
              [["s-mx-auto", "s-max-w-4xl"].join(" ")]: fixed,
              [["s-px-3 s-py-8", "@sm:s-px-6", "@md:s-px-9", "@lg:s-px-12"].join(" ")]: !noPadding,
            })}
          >
            {children}
          </div>
          <ScrollBar size="classic" orientation="vertical" />
        </ScrollArea>
      </div>
    );
  }
);

Container.displayName = "Container";
