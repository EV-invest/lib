import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useFloating } from "../primitives/use-floating";
import { useDismissableLayer } from "../primitives/dismissable-layer";
import { usePresence } from "../primitives/presence";
import { useRovingFocus } from "../primitives/use-roving-focus";
import { mergeRefs } from "../primitives/merge-refs";
import { Portal } from "../primitives/portal";

interface SelectContextValue {
  value: string;
  setValue: (next: string) => void;
  open: boolean;
  setOpen: (next: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelect(): SelectContextValue {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error("Select parts must be used within <Select>");
  return ctx;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function Select({
  value,
  defaultValue = "",
  onValueChange,
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: SelectProps) {
  const [currentValue, setValue] = useControllableState<string>({
    ...(value !== undefined ? { value } : {}),
    defaultValue,
    ...(onValueChange ? { onChange: onValueChange } : {}),
  });
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  const anchorRef = React.useRef<HTMLElement | null>(null);
  return (
    <SelectContext.Provider
      value={{ value: currentValue, setValue, open: isOpen, setOpen, anchorRef }}
    >
      {children}
    </SelectContext.Provider>
  );
}

export interface SelectTriggerProps extends React.ComponentProps<"button"> {
  size?: "sm" | "default";
}

export function SelectTrigger({
  className,
  size = "default",
  onClick,
  children,
  ...props
}: SelectTriggerProps) {
  const { open, setOpen, anchorRef } = useSelect();
  return (
    <button
      type="button"
      role="combobox"
      data-slot="select-trigger"
      data-size={size}
      data-state={open ? "open" : "closed"}
      aria-expanded={open}
      ref={anchorRef as React.Ref<HTMLButtonElement>}
      onClick={(e) => {
        onClick?.(e);
        setOpen(!open);
      }}
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...(props as Record<string, unknown>)}
    >
      {children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4 opacity-50"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

export interface SelectValueProps extends React.ComponentProps<"span"> {
  placeholder?: string;
}

export function SelectValue({ className, placeholder, ...props }: SelectValueProps) {
  const { value } = useSelect();
  const isEmpty = value === "";
  return (
    <span
      data-slot="select-value"
      {...(isEmpty ? { "data-placeholder": "true" } : {})}
      className={className}
      {...(props as Record<string, unknown>)}
    >
      {isEmpty ? placeholder : value}
    </span>
  );
}

export interface SelectContentProps extends React.ComponentProps<"div"> {
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

export function SelectContent({
  className,
  side: sideProp = "bottom",
  align = "start",
  sideOffset = 4,
  children,
  ...props
}: SelectContentProps) {
  const { open, setOpen, anchorRef } = useSelect();
  const { isPresent, ref: presRef } = usePresence(open);
  const { floatingRef, style, side } = useFloating({
    anchorRef,
    open,
    side: sideProp,
    align,
    offset: sideOffset,
  });
  const dismissRef = useDismissableLayer({
    enabled: open,
    onDismiss: () => setOpen(false),
    exclude: [anchorRef],
  });
  const items = React.Children.toArray(children).filter(React.isValidElement);
  const { activeIndex, setActiveIndex, onKeyDown } = useRovingFocus({
    count: items.length,
    orientation: "vertical",
  });
  if (!isPresent) return null;
  return (
    <Portal>
      <div
        role="listbox"
        data-slot="select-content"
        data-state={open ? "open" : "closed"}
        data-side={side}
        ref={mergeRefs(floatingRef, dismissRef, presRef)}
        style={style}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-96 min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
          className,
        )}
        {...(props as Record<string, unknown>)}
      >
        <div className="p-1">
          {items.map((child, index) =>
            React.cloneElement(child as React.ReactElement<SelectItemContext>, {
              __index: index,
              __active: index === activeIndex,
              __setActive: setActiveIndex,
            }),
          )}
        </div>
      </div>
    </Portal>
  );
}

interface SelectItemContext {
  __index?: number;
  __active?: boolean;
  __setActive?: (i: number) => void;
}

export interface SelectItemProps
  extends React.ComponentProps<"div">,
    SelectItemContext {
  value: string;
}

export function SelectItem({
  className,
  value,
  children,
  __index = 0,
  __active = false,
  __setActive,
  ...props
}: SelectItemProps) {
  const { value: selectedValue, setValue, setOpen } = useSelect();
  const selected = selectedValue === value;
  return (
    <div
      role="option"
      data-slot="select-item"
      aria-selected={selected}
      tabIndex={__active ? 0 : -1}
      onFocus={() => __setActive?.(__index)}
      onClick={() => {
        setValue(value);
        setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setValue(value);
          setOpen(false);
        }
      }}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...(props as Record<string, unknown>)}
    >
      {selected ? (
        <span className="absolute right-2 flex size-3.5 items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      ) : null}
      <span>{children}</span>
    </div>
  );
}

export function SelectGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div role="group" data-slot="select-group" className={className} {...props} />;
}

export function SelectLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  );
}

export function SelectSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}
