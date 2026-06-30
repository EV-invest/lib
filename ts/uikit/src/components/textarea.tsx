import * as React from "react";
import { cn } from "../lib/cn";
import { TEXTAREA_BASE } from "../generated/textarea";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea data-slot="textarea" className={cn(TEXTAREA_BASE, className)} {...props} />
  );
}
