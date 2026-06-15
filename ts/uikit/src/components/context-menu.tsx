import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useDismissableLayer } from "../primitives/dismissable-layer";
import { usePresence } from "../primitives/presence";
import { useRovingFocus } from "../primitives/use-roving-focus";
import { mergeRefs } from "../primitives/merge-refs";
import { Portal } from "../primitives/portal";
import { Slot } from "../primitives/slot";

interface ContextMenuContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  point: { x: number; y: number };
  setPoint: (p: { x: number; y: number }) => void;
}

const ContextMenuContext = React.createContext<ContextMenuContextValue | null>(null);

function useContextMenu(): ContextMenuContextValue {
  const ctx = React.useContext(ContextMenuContext);
  if (!ctx) throw new Error("ContextMenu parts must be used within <ContextMenu>");
  return ctx;
}

export interface ContextMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function ContextMenu({ open, defaultOpen = false, onOpenChange, children }: ContextMenuProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  const [point, setPoint] = React.useState({ x: 0, y: 0 });
  return (
    <ContextMenuContext.Provider value={{ open: isOpen, setOpen, point, setPoint }}>
      <div data-slot="context-menu">{children}</div>
    </ContextMenuContext.Provider>
  );
}

export function ContextMenuPortal({ children }: { children?: React.ReactNode }) {
  return <Portal>{children}</Portal>;
}

export interface ContextMenuTriggerProps extends React.ComponentProps<"div"> {
  asChild?: boolean;
}

export function ContextMenuTrigger({ asChild = false, onContextMenu, ...props }: ContextMenuTriggerProps) {
  const { setOpen, setPoint } = useContextMenu();
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="context-menu-trigger"
      onContextMenu={(e: React.MouseEvent<HTMLDivElement>) => {
        onContextMenu?.(e);
        e.preventDefault();
        setPoint({ x: e.clientX, y: e.clientY });
        setOpen(true);
      }}
      {...(props as Record<string, unknown>)}
    />
  );
}

export function ContextMenuGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="context-menu-group" role="group" className={className} {...props} />;
}

const ContextMenuCloseContext = React.createContext<() => void>(() => {});

export function ContextMenuContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const { open, setOpen, point } = useContextMenu();
  const { isPresent, ref: presRef } = usePresence(open);
  const dismissRef = useDismissableLayer({
    enabled: open,
    onDismiss: () => setOpen(false),
  });
  const contentRef = React.useRef<HTMLDivElement | null>(null);
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
  const close = React.useCallback(() => setOpen(false), [setOpen]);
  if (!isPresent) return null;
  return (
    <Portal>
      <ContextMenuCloseContext.Provider value={close}>
        <div
          data-slot="context-menu-content"
          data-state={open ? "open" : "closed"}
          data-side="bottom"
          role="menu"
          tabIndex={-1}
          onKeyDown={(e) => {
            rovingKeyDown(e);
            if (e.key === "Escape") setOpen(false);
          }}
          ref={mergeRefs(dismissRef, presRef, contentRef)}
          style={{ position: "fixed", top: point.y, left: point.x }}
          className={cn(
            "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
            className,
          )}
          {...(props as Record<string, unknown>)}
        >
          {children}
        </div>
      </ContextMenuCloseContext.Provider>
    </Portal>
  );
}

export interface ContextMenuItemProps extends React.ComponentProps<"div"> {
  inset?: boolean;
  variant?: "default" | "destructive";
  disabled?: boolean;
}

export function ContextMenuItem({
  className,
  inset,
  variant = "default",
  disabled,
  onClick,
  onKeyDown,
  ...props
}: ContextMenuItemProps) {
  const close = React.useContext(ContextMenuCloseContext);
  return (
    <div
      data-slot="context-menu-item"
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

export interface ContextMenuCheckboxItemProps extends React.ComponentProps<"div"> {
  checked?: boolean;
  disabled?: boolean;
}

export function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  disabled,
  onClick,
  ...props
}: ContextMenuCheckboxItemProps) {
  const close = React.useContext(ContextMenuCloseContext);
  return (
    <div
      data-slot="context-menu-checkbox-item"
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

interface ContextMenuRadioGroupContextValue {
  value: string | undefined;
  setValue: (next: string) => void;
}

const ContextMenuRadioGroupContext =
  React.createContext<ContextMenuRadioGroupContextValue | null>(null);

export interface ContextMenuRadioGroupProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  value?: string;
  onValueChange?: (value: string) => void;
}

export function ContextMenuRadioGroup({
  className,
  value,
  onValueChange,
  children,
  ...props
}: ContextMenuRadioGroupProps) {
  const ctx = React.useMemo<ContextMenuRadioGroupContextValue>(
    () => ({ value, setValue: (next) => onValueChange?.(next) }),
    [value, onValueChange],
  );
  return (
    <ContextMenuRadioGroupContext.Provider value={ctx}>
      <div data-slot="context-menu-radio-group" role="group" className={className} {...props}>
        {children}
      </div>
    </ContextMenuRadioGroupContext.Provider>
  );
}

export interface ContextMenuRadioItemProps extends React.ComponentProps<"div"> {
  value: string;
  disabled?: boolean;
}

export function ContextMenuRadioItem({
  className,
  children,
  value,
  disabled,
  onClick,
  ...props
}: ContextMenuRadioItemProps) {
  const close = React.useContext(ContextMenuCloseContext);
  const group = React.useContext(ContextMenuRadioGroupContext);
  const checked = group?.value === value;
  return (
    <div
      data-slot="context-menu-radio-item"
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

export interface ContextMenuLabelProps extends React.ComponentProps<"div"> {
  inset?: boolean;
}

export function ContextMenuLabel({ className, inset, ...props }: ContextMenuLabelProps) {
  return (
    <div
      data-slot="context-menu-label"
      data-inset={inset ? "" : undefined}
      className={cn("text-foreground px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className)}
      {...props}
    />
  );
}

export function ContextMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="context-menu-separator"
      role="separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

export function ContextMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
      {...props}
    />
  );
}

// Sub-menus render inline (nested) rather than in a separate floating layer:
// the sub-content is revealed in place when its trigger toggles.
interface ContextMenuSubContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
}

const ContextMenuSubContext = React.createContext<ContextMenuSubContextValue | null>(null);

export interface ContextMenuSubProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function ContextMenuSub({ open, defaultOpen = false, onOpenChange, children }: ContextMenuSubProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  return (
    <ContextMenuSubContext.Provider value={{ open: isOpen, setOpen }}>
      <div data-slot="context-menu-sub">{children}</div>
    </ContextMenuSubContext.Provider>
  );
}

export interface ContextMenuSubTriggerProps extends React.ComponentProps<"div"> {
  inset?: boolean;
}

export function ContextMenuSubTrigger({ className, inset, children, onClick, ...props }: ContextMenuSubTriggerProps) {
  const ctx = React.useContext(ContextMenuSubContext);
  return (
    <div
      data-slot="context-menu-sub-trigger"
      data-inset={inset ? "" : undefined}
      data-state={ctx?.open ? "open" : "closed"}
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={ctx?.open}
      tabIndex={-1}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        ctx?.setOpen(!ctx.open);
      }}
      {...props}
    >
      {children}
      <svg className="ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </div>
  );
}

export function ContextMenuSubContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const ctx = React.useContext(ContextMenuSubContext);
  if (!ctx?.open) return null;
  return (
    <div
      data-slot="context-menu-sub-content"
      data-state="open"
      role="menu"
      className={cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
