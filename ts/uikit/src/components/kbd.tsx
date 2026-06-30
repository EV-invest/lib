import * as React from "react";
import { cn } from "../lib/cn";
import { KBD_BASE, KBD_GROUP_BASE } from "../generated/kbd";

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(KBD_BASE, className)}
      {...props}
    />
  );
}

export function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn(KBD_GROUP_BASE, className)}
      {...props}
    />
  );
}
