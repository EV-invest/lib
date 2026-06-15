import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";

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
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        setOn(!on);
      }}
      {...props}
    >
      <span
        data-slot="switch-thumb"
        data-state={state}
        className="bg-background pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
      />
    </button>
  );
}
