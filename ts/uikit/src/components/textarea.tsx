import * as React from "react";
import { cn } from "../lib/cn";
import { TEXTAREA_BASE, textareaSizeClasses, type TextareaSize } from "../generated/textarea";
import { useFieldControlId } from "./field-context";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  size?: TextareaSize;
}

export function Textarea({ className, id, size = "md", ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      data-size={size}
      id={useFieldControlId(id)}
      className={cn(TEXTAREA_BASE, textareaSizeClasses[size], className)}
      {...props}
    />
  );
}
