"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { CHECKBOX_BASE, CHECKBOX_INDICATOR } from "../generated/checkbox";
import { useControllableState } from "../primitives/use-controllable-state";
import { useFieldControlId } from "./field-context";

export interface CheckboxProps
  extends Omit<React.ComponentProps<"button">, "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Checkbox({
  className,
  checked,
  defaultChecked = false,
  onCheckedChange,
  onClick,
  disabled,
  id,
  ...props
}: CheckboxProps) {
  const [on, setOn] = useControllableState<boolean>({
    ...(checked !== undefined ? { value: checked } : {}),
    defaultValue: defaultChecked,
    ...(onCheckedChange ? { onChange: onCheckedChange } : {}),
  });
  const state = on ? "checked" : "unchecked";
  return (
    <button
      type="button"
      role="checkbox"
      data-slot="checkbox"
      data-state={state}
      aria-checked={on}
      disabled={disabled}
      id={useFieldControlId(id)}
      className={cn(CHECKBOX_BASE, className)}
      onClick={(e) => {
        onClick?.(e);
        setOn(!on);
      }}
      {...props}
    >
      {on && (
        <span
          data-slot="checkbox-indicator"
          className={CHECKBOX_INDICATOR}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      )}
    </button>
  );
}
