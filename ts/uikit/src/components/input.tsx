"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { INPUT_BASE, inputSizeClasses, type InputSize } from "../generated/input";
import { useFieldControlId } from "./field-context";

export type { InputSize };

// The native `size` attribute (a width in characters) gives way to the kit's
// scale, as it does on `NativeSelect`; a width belongs in `className`.
export interface InputProps extends Omit<React.ComponentPropsWithoutRef<"input">, "size"> {
  size?: InputSize;
}

// `forwardRef` rather than a `ref` prop so the handle also reaches the element
// under React 18, where function components drop `ref`.
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, type, id, size = "md", ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        id={useFieldControlId(id)}
        data-slot="input"
        data-size={size}
        className={cn(INPUT_BASE, inputSizeClasses[size], className)}
        {...props}
      />
    );
  },
);
