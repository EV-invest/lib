import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { Portal } from "../primitives/portal";
import { useFloating } from "../primitives/use-floating";
import { useDismissableLayer } from "../primitives/dismissable-layer";
import { usePresence } from "../primitives/presence";
import { useRovingFocus } from "../primitives/use-roving-focus";
import { mergeRefs } from "../primitives/merge-refs";

const CONTENT =
  "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:fade-out-0 " +
  "data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 " +
  "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 " +
  "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[12rem] " +
  "overflow-hidden rounded-md border p-1 shadow-md";

const SUB_CONTENT =
  "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out " +
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 " +
  "data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 " +
  "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] " +
  "overflow-hidden rounded-md border p-1 shadow-lg";

interface MenuCtx {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}
const MenubarMenuContext = React.createContext<MenuCtx | null>(null);
function useMenu(): MenuCtx {
  const ctx = React.useContext(MenubarMenuContext);
  if (!ctx) throw new Error("Menubar parts must be used within <MenubarMenu>");
  return ctx;
}

const MenubarRadioGroupContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
} | null>(null);

export function Menubar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="menubar"
      role="menubar"
      className={cn(
        "bg-background flex h-9 items-center gap-1 rounded-md border p-1 shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

export interface MenubarMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function MenubarMenu({ open, defaultOpen = false, onOpenChange, children }: MenubarMenuProps) {
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  return (
    <MenubarMenuContext.Provider value={{ open: isOpen, setOpen, triggerRef }}>
      <div data-slot="menubar-menu" className="relative">
        {children}
      </div>
    </MenubarMenuContext.Provider>
  );
}

export function MenubarTrigger({ className, onClick, ...props }: React.ComponentProps<"button">) {
  const { open, setOpen, triggerRef } = useMenu();
  return (
    <button
      ref={triggerRef}
      type="button"
      data-slot="menubar-trigger"
      data-state={open ? "open" : "closed"}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-hidden select-none",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        setOpen(!open);
      }}
      {...props}
    />
  );
}

export function MenubarContent({
  className,
  children,
  align = "start",
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "center" | "end" }) {
  const { open, setOpen, triggerRef } = useMenu();
  const { isPresent, ref: presenceRef } = usePresence(open);
  const { floatingRef, style, side } = useFloating({
    anchorRef: triggerRef,
    open,
    side: "bottom",
    align,
    offset: 8,
  });
  const dismissRef = useDismissableLayer({
    enabled: open,
    onDismiss: () => setOpen(false),
    exclude: [triggerRef],
  });

  const items = React.Children.toArray(children);
  const { onKeyDown } = useRovingFocus({ count: items.length, orientation: "vertical" });

  if (!isPresent) return null;
  return (
    <Portal>
      <div
        ref={mergeRefs(presenceRef, floatingRef, dismissRef)}
        data-slot="menubar-content"
        data-state={open ? "open" : "closed"}
        data-side={side}
        role="menu"
        style={style}
        className={cn(CONTENT, className)}
        onKeyDown={onKeyDown}
        {...props}
      >
        {children}
      </div>
    </Portal>
  );
}

export function MenubarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="menubar-group" role="group" className={className} {...props} />;
}

export function MenubarItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <div
      data-slot="menubar-item"
      data-inset={inset}
      data-variant={variant}
      role="menuitem"
      tabIndex={-1}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function MenubarCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<"div"> & { checked?: boolean }) {
  return (
    <div
      data-slot="menubar-checkbox-item"
      role="menuitemcheckbox"
      aria-checked={checked}
      tabIndex={-1}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked && (
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      {children}
    </div>
  );
}

export interface MenubarRadioGroupProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export function MenubarRadioGroup({
  value,
  defaultValue = "",
  onValueChange,
  className,
  children,
}: MenubarRadioGroupProps) {
  const [current, setValue] = useControllableState({
    value,
    defaultValue,
    onChange: onValueChange,
  });
  return (
    <MenubarRadioGroupContext.Provider value={{ value: current, onValueChange: setValue }}>
      <div data-slot="menubar-radio-group" role="group" className={className}>
        {children}
      </div>
    </MenubarRadioGroupContext.Provider>
  );
}

export function MenubarRadioItem({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<"div"> & { value: string }) {
  const ctx = React.useContext(MenubarRadioGroupContext);
  const checked = ctx?.value === value;
  return (
    <div
      data-slot="menubar-radio-item"
      role="menuitemradio"
      aria-checked={checked}
      tabIndex={-1}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onClick={() => ctx?.onValueChange(value)}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked && (
          <svg className="size-2 fill-current" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
          </svg>
        )}
      </span>
      {children}
    </div>
  );
}

export function MenubarLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="menubar-label"
      data-inset={inset}
      className={cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className)}
      {...props}
    />
  );
}

export function MenubarSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="menubar-separator"
      role="separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

export function MenubarShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="menubar-shortcut"
      className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
      {...props}
    />
  );
}

interface SubCtx {
  open: boolean;
  setOpen: (open: boolean) => void;
}
const MenubarSubContext = React.createContext<SubCtx | null>(null);
function useSub(): SubCtx {
  const ctx = React.useContext(MenubarSubContext);
  if (!ctx) throw new Error("MenubarSub parts must be used within <MenubarSub>");
  return ctx;
}

export interface MenubarSubProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function MenubarSub({ open, defaultOpen = false, onOpenChange, children }: MenubarSubProps) {
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  return (
    <MenubarSubContext.Provider value={{ open: isOpen, setOpen }}>
      <div data-slot="menubar-sub" className="relative">
        {children}
      </div>
    </MenubarSubContext.Provider>
  );
}

export function MenubarSubTrigger({
  className,
  inset,
  children,
  onClick,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  const { open, setOpen } = useSub();
  return (
    <div
      data-slot="menubar-sub-trigger"
      data-inset={inset}
      data-state={open ? "open" : "closed"}
      role="menuitem"
      tabIndex={-1}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[inset]:pl-8",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        setOpen(!open);
      }}
      {...props}
    >
      {children}
      <svg
        className="ml-auto h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </div>
  );
}

export function MenubarSubContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const { open } = useSub();
  const { isPresent, ref } = usePresence(open);
  if (!isPresent) return null;
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      data-slot="menubar-sub-content"
      data-state={open ? "open" : "closed"}
      role="menu"
      className={cn(SUB_CONTENT, className)}
      {...props}
    >
      {children}
    </div>
  );
}
