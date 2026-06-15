import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import {
  toggleVariants,
  type ToggleVariant,
  type ToggleSize,
} from "./toggle";

type ToggleGroupContextValue = {
  variant: ToggleVariant;
  size: ToggleSize;
  value: string[];
  toggle: (itemValue: string) => void;
};

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  variant: "default",
  size: "default",
  value: [],
  toggle: () => {},
});

export interface ToggleGroupProps
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  variant?: ToggleVariant;
  size?: ToggleSize;
  type?: "single" | "multiple";
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
}

function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : v === "" ? [] : [v];
}

export function ToggleGroup({
  className,
  variant = "default",
  size = "default",
  type = "single",
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: ToggleGroupProps) {
  const [selected, setSelected] = useControllableState<string[]>({
    ...(value !== undefined ? { value: toArray(value) } : {}),
    defaultValue: toArray(defaultValue),
    onChange: (next) =>
      onValueChange?.(type === "single" ? (next[0] ?? "") : next),
  });

  const toggle = React.useCallback(
    (itemValue: string) => {
      if (type === "single") {
        setSelected(selected.includes(itemValue) ? [] : [itemValue]);
      } else {
        setSelected(
          selected.includes(itemValue)
            ? selected.filter((v) => v !== itemValue)
            : [...selected, itemValue],
        );
      }
    },
    [type, selected, setSelected],
  );

  return (
    <div
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        "group/toggle-group flex w-fit items-center rounded-md data-[variant=outline]:shadow-xs",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, value: selected, toggle }}>
        {children}
      </ToggleGroupContext.Provider>
    </div>
  );
}

export interface ToggleGroupItemProps
  extends Omit<React.ComponentProps<"button">, "value" | "onChange"> {
  value: string;
  variant?: ToggleVariant;
  size?: ToggleSize;
}

export function ToggleGroupItem({
  className,
  children,
  value,
  variant,
  size,
  onClick,
  ...props
}: ToggleGroupItemProps) {
  const context = React.useContext(ToggleGroupContext);
  const resolvedVariant = context.variant || variant || "default";
  const resolvedSize = context.size || size || "default";
  const on = context.value.includes(value);

  return (
    <button
      type="button"
      data-slot="toggle-group-item"
      data-variant={resolvedVariant}
      data-size={resolvedSize}
      data-state={on ? "on" : "off"}
      aria-pressed={on}
      className={cn(
        toggleVariants({ variant: resolvedVariant, size: resolvedSize }),
        "min-w-0 flex-1 shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10 data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        context.toggle(value);
      }}
      {...props}
    >
      {children}
    </button>
  );
}
