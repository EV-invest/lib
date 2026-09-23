"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { INPUT_BASE } from "../generated/input";
import { useFieldControlId } from "./field-context";

// `forwardRef` rather than a `ref` prop so the handle also reaches the element
// under React 18, where function components drop `ref`.
export const Input = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<"input">>(
  function Input({ className, type, id, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        id={useFieldControlId(id)}
        data-slot="input"
        className={cn(INPUT_BASE, className)}
        {...props}
      />
    );
  },
);
