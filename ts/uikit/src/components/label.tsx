import * as React from "react";
import { cn } from "../lib/cn";
import { LABEL_BASE } from "../generated/label";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn(LABEL_BASE, className)} {...props} />;
}
