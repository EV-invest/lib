import * as React from "react";
import { cn } from "../lib/cn";
import { INPUT_BASE } from "../generated/input";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(INPUT_BASE, className)}
      {...props}
    />
  );
}
