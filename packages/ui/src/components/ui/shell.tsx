import * as React from "react";
import { cn } from "../../lib/utils";

type ApplicationShellProps = React.HTMLAttributes<HTMLDivElement>;

export function ApplicationShell({ className, children, ...props }: ApplicationShellProps) {
  return (
    <div
      className={cn(
        "bg-background text-foreground relative flex min-h-dvh w-full max-w-full",
        "safe-area-inset-x prevent-horizontal-scroll",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
