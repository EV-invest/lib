import * as React from "react";
import { cn } from "../lib/cn";
import { TEXTAREA_BASE } from "../generated/textarea";
import { useFieldControlId } from "./field-context";

export function Textarea({ className, id, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      id={useFieldControlId(id)}
      className={cn(TEXTAREA_BASE, className)}
      {...props}
    />
  );
}
