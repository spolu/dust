import * as React from "react";

import { cn } from "@app/components/poke/shadcn/lib/utils";

export type PokeTextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const PokeTextarea = React.forwardRef<HTMLTextAreaElement, PokeTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
PokeTextarea.displayName = "Textarea";

export { PokeTextarea };
