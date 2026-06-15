import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useRovingFocus } from "../primitives/use-roving-focus";

const ROOT_BASE = "grid gap-3";
const ITEM_BASE =
  "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 " +
  "aria-invalid:ring-destructive/20 aria-invalid:border-destructive aspect-square size-4 " +
  "shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none " +
  "focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50";

interface RadioGroupContextValue {
  value: string;
  setValue: (next: string) => void;
  register: (el: HTMLButtonElement | null) => number;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null,
);

export interface RadioGroupProps
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export function RadioGroup({
  className,
  value,
  defaultValue = "",
  onValueChange,
  children,
  onKeyDown,
  ...props
}: RadioGroupProps) {
  const [current, setCurrent] = useControllableState<string>({
    ...(value !== undefined ? { value } : {}),
    defaultValue,
    ...(onValueChange ? { onChange: onValueChange } : {}),
  });

  const itemsRef = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [count, setCount] = React.useState(0);

  const { activeIndex, setActiveIndex, onKeyDown: rovingKeyDown } =
    useRovingFocus({ count, orientation: "vertical", loop: true });

  const register = React.useCallback((el: HTMLButtonElement | null): number => {
    const list = itemsRef.current;
    let index = list.indexOf(el);
    if (index === -1) {
      index = list.length;
      list[index] = el;
      setCount(list.filter(Boolean).length);
    }
    return index;
  }, []);

  const ctx = React.useMemo<RadioGroupContextValue>(
    () => ({ value: current, setValue: setCurrent, register, activeIndex, setActiveIndex }),
    [current, setCurrent, register, activeIndex, setActiveIndex],
  );

  return (
    <RadioGroupContext.Provider value={ctx}>
      <div
        data-slot="radio-group"
        role="radiogroup"
        className={cn(ROOT_BASE, className)}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          rovingKeyDown(e);
        }}
        {...props}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioGroupItemProps
  extends Omit<React.ComponentProps<"button">, "value"> {
  value: string;
}

export function RadioGroupItem({
  className,
  value,
  disabled,
  onClick,
  ...props
}: RadioGroupItemProps) {
  const ctx = React.useContext(RadioGroupContext);
  if (!ctx) throw new Error("RadioGroupItem must be used within a RadioGroup");
  const indexRef = React.useRef(-1);
  const checked = ctx.value === value;

  React.useEffect(() => {
    if (checked) ctx.setActiveIndex(indexRef.current);
  }, [checked]);

  return (
    <button
      ref={(el) => {
        indexRef.current = ctx.register(el);
      }}
      type="button"
      data-slot="radio-group-item"
      data-state={checked ? "checked" : "unchecked"}
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      tabIndex={indexRef.current === ctx.activeIndex ? 0 : -1}
      className={cn(ITEM_BASE, className)}
      onClick={(e) => {
        onClick?.(e);
        ctx.setValue(value);
      }}
      {...props}
    >
      {checked ? (
        <span
          data-slot="radio-group-indicator"
          className="relative flex items-center justify-center"
        >
          <svg
            className="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
          </svg>
        </span>
      ) : null}
    </button>
  );
}
