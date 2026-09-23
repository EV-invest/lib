"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { SWITCH_BASE, SWITCH_THUMB } from "../generated/switch";
import { useControllableState } from "../primitives/use-controllable-state";
import { useFieldControlId } from "./field-context";

export interface SwitchProps
  extends Omit<React.ComponentProps<"button">, "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({
  className,
  checked,
  defaultChecked = false,
  onCheckedChange,
  onClick,
  disabled,
  id,
  ...props
}: SwitchProps) {
  const [on, setOn] = useControllableState<boolean>({
    ...(checked !== undefined ? { value: checked } : {}),
    defaultValue: defaultChecked,
    ...(onCheckedChange ? { onChange: onCheckedChange } : {}),
  });
  const state = on ? "checked" : "unchecked";
  return (
    <button
      type="button"
      role="switch"
      data-slot="switch"
      data-state={state}
      aria-checked={on}
      disabled={disabled}
      id={useFieldControlId(id)}
      className={cn(SWITCH_BASE, className)}
      onClick={(e) => {
        onClick?.(e);
        setOn(!on);
      }}
      {...props}
    >
      <span
        data-slot="switch-thumb"
        data-state={state}
        className={SWITCH_THUMB}
      />
    </button>
  );
}
