import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useFloating } from "../primitives/use-floating";
import { useDismissableLayer } from "../primitives/dismissable-layer";
import { usePresence } from "../primitives/presence";
import { useRovingFocus } from "../primitives/use-roving-focus";
import { mergeRefs } from "../primitives/merge-refs";
import { Portal } from "../primitives/portal";
import { Slot } from "../primitives/slot";

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(
  null,
);

function useDropdownMenu(): DropdownMenuContextValue {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error("DropdownMenu parts must be used within <DropdownMenu>");
  return ctx;
}

export interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function DropdownMenu({ open, defaultOpen = false, onOpenChange, children }: DropdownMenuProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  const anchorRef = React.useRef<HTMLElement | null>(null);
  return (
    <DropdownMenuContext.Provider value={{ open: isOpen, setOpen, anchorRef }}>
      <div data-slot="dropdown-menu">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuPortal({ children }: { children?: React.ReactNode }) {
  return <Portal>{children}</Portal>;
}

export interface DropdownMenuTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
}

export function DropdownMenuTrigger({ asChild = false, onClick, ...props }: DropdownMenuTriggerProps) {
  const { open, setOpen, anchorRef } = useDropdownMenu();
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="dropdown-menu-trigger"
      aria-haspopup="menu"
      aria-expanded={open}
      data-state={open ? "open" : "closed"}
      ref={anchorRef as React.Ref<HTMLButtonElement>}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        setOpen(!open);
      }}
      {...(props as Record<string, unknown>)}
    />
  );
}

export interface DropdownMenuContentProps extends React.ComponentProps<"div"> {
  sideOffset?: number;
}

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: DropdownMenuContentProps) {
  const { open, setOpen, anchorRef } = useDropdownMenu();
  const { isPresent, ref: presRef } = usePresence(open);
  const { floatingRef, style, side } = useFloating({
    anchorRef,
    open,
    side: "bottom",
    align: "start",
    offset: sideOffset,
  });
  const dismissRef = useDismissableLayer({
    enabled: open,
    onDismiss: () => setOpen(false),
    exclude: [anchorRef],
  });
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  // Roving focus across rendered menu items: ArrowUp/Down move the active item.
  const items = () =>
    Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>("[role^='menuitem']") ?? [],
    ).filter((el) => el.getAttribute("data-disabled") === null);
  const { activeIndex, onKeyDown: rovingKeyDown } = useRovingFocus({
    count: 64,
    orientation: "vertical",
    loop: true,
  });
  React.useEffect(() => {
    if (!open) return;
    items()[activeIndex]?.focus();
  }, [open, activeIndex]);
  // Selecting an item closes the menu: items call this through context.
  const close = React.useCallback(() => setOpen(false), [setOpen]);
  if (!isPresent) return null;
  return (
    <Portal>
      <DropdownMenuCloseContext.Provider value={close}>
        <div
          data-slot="dropdown-menu-content"
          data-state={open ? "open" : "closed"}
          data-side={side}
          role="menu"
          tabIndex={-1}
          onKeyDown={(e) => {
            rovingKeyDown(e);
            if (e.key === "Escape") setOpen(false);
          }}
          ref={mergeRefs(floatingRef, dismissRef, presRef, contentRef)}
          style={style}
          className={cn(
            "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
            className,
          )}
          {...(props as Record<string, unknown>)}
        >
          {children}
        </div>
      </DropdownMenuCloseContext.Provider>
    </Portal>
  );
}

const DropdownMenuCloseContext = React.createContext<() => void>(() => {});

export function DropdownMenuGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dropdown-menu-group" role="group" className={className} {...props} />;
}

export interface DropdownMenuItemProps extends React.ComponentProps<"div"> {
  inset?: boolean;
  variant?: "default" | "destructive";
  disabled?: boolean;
}

export function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  disabled,
  onClick,
  onKeyDown,
  ...props
}: DropdownMenuItemProps) {
  const close = React.useContext(DropdownMenuCloseContext);
  return (
    <div
      data-slot="dropdown-menu-item"
      data-inset={inset ? "" : undefined}
      data-variant={variant}
      data-disabled={disabled ? "" : undefined}
      role="menuitem"
      tabIndex={disabled ? undefined : -1}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onClick={(e) => {
        if (disabled) return;
        onClick?.(e);
        close();
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).click();
        }
      }}
      {...props}
    />
  );
}

export interface DropdownMenuCheckboxItemProps extends React.ComponentProps<"div"> {
  checked?: boolean;
  disabled?: boolean;
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  disabled,
  onClick,
  ...props
}: DropdownMenuCheckboxItemProps) {
  const close = React.useContext(DropdownMenuCloseContext);
  return (
    <div
      data-slot="dropdown-menu-checkbox-item"
      role="menuitemcheckbox"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      data-disabled={disabled ? "" : undefined}
      tabIndex={disabled ? undefined : -1}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onClick={(e) => {
        if (disabled) return;
        onClick?.(e);
        close();
      }}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked ? (
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : null}
      </span>
      {children}
    </div>
  );
}

interface DropdownMenuRadioGroupContextValue {
  value: string | undefined;
  setValue: (next: string) => void;
}

const DropdownMenuRadioGroupContext =
  React.createContext<DropdownMenuRadioGroupContextValue | null>(null);

export interface DropdownMenuRadioGroupProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  value?: string;
  onValueChange?: (value: string) => void;
}

export function DropdownMenuRadioGroup({
  className,
  value,
  onValueChange,
  children,
  ...props
}: DropdownMenuRadioGroupProps) {
  const ctx = React.useMemo<DropdownMenuRadioGroupContextValue>(
    () => ({ value, setValue: (next) => onValueChange?.(next) }),
    [value, onValueChange],
  );
  return (
    <DropdownMenuRadioGroupContext.Provider value={ctx}>
      <div data-slot="dropdown-menu-radio-group" role="group" className={className} {...props}>
        {children}
      </div>
    </DropdownMenuRadioGroupContext.Provider>
  );
}

export interface DropdownMenuRadioItemProps extends React.ComponentProps<"div"> {
  value: string;
  disabled?: boolean;
}

export function DropdownMenuRadioItem({
  className,
  children,
  value,
  disabled,
  onClick,
  ...props
}: DropdownMenuRadioItemProps) {
  const close = React.useContext(DropdownMenuCloseContext);
  const group = React.useContext(DropdownMenuRadioGroupContext);
  const checked = group?.value === value;
  return (
    <div
      data-slot="dropdown-menu-radio-item"
      role="menuitemradio"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      data-disabled={disabled ? "" : undefined}
      tabIndex={disabled ? undefined : -1}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onClick={(e) => {
        if (disabled) return;
        onClick?.(e);
        group?.setValue(value);
        close();
      }}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked ? (
          <svg className="size-2 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
          </svg>
        ) : null}
      </span>
      {children}
    </div>
  );
}

export interface DropdownMenuLabelProps extends React.ComponentProps<"div"> {
  inset?: boolean;
}

export function DropdownMenuLabel({ className, inset, ...props }: DropdownMenuLabelProps) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset ? "" : undefined}
      className={cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dropdown-menu-separator"
      role="separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

export function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
      {...props}
    />
  );
}

// Sub-menus render inline (nested) rather than in a separate floating layer: the
// sub-content is revealed in place when its trigger toggles, simplifying the
// nesting Radix portals each level. data-state still reflects open/closed.
interface DropdownMenuSubContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
}

const DropdownMenuSubContext = React.createContext<DropdownMenuSubContextValue | null>(null);

export interface DropdownMenuSubProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function DropdownMenuSub({ open, defaultOpen = false, onOpenChange, children }: DropdownMenuSubProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  return (
    <DropdownMenuSubContext.Provider value={{ open: isOpen, setOpen }}>
      <div data-slot="dropdown-menu-sub">{children}</div>
    </DropdownMenuSubContext.Provider>
  );
}

export interface DropdownMenuSubTriggerProps extends React.ComponentProps<"div"> {
  inset?: boolean;
}

export function DropdownMenuSubTrigger({ className, inset, children, onClick, ...props }: DropdownMenuSubTriggerProps) {
  const ctx = React.useContext(DropdownMenuSubContext);
  return (
    <div
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset ? "" : undefined}
      data-state={ctx?.open ? "open" : "closed"}
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={ctx?.open}
      tabIndex={-1}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        ctx?.setOpen(!ctx.open);
      }}
      {...props}
    >
      {children}
      <svg className="ml-auto size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </div>
  );
}

export function DropdownMenuSubContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const ctx = React.useContext(DropdownMenuSubContext);
  if (!ctx?.open) return null;
  return (
    <div
      data-slot="dropdown-menu-sub-content"
      data-state="open"
      role="menu"
      className={cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
