import * as React from "react";
import { cn } from "../lib/cn";
import { Slot } from "../primitives/slot";
import { useControllableState } from "../primitives/use-controllable-state";
import {
  SIDEBAR_MENU_BUTTON_BASE,
  sidebarMenuButtonVariantClasses,
  sidebarMenuButtonSizeClasses,
  SIDEBAR_WRAPPER,
  SIDEBAR_FLAT,
  SIDEBAR_INNER,
  SIDEBAR_TRIGGER,
  SIDEBAR_RAIL,
  SIDEBAR_INSET,
  SIDEBAR_HEADER,
  SIDEBAR_FOOTER,
  SIDEBAR_SEPARATOR,
  SIDEBAR_CONTENT,
  SIDEBAR_GROUP,
  SIDEBAR_GROUP_LABEL,
  SIDEBAR_GROUP_CONTENT,
  SIDEBAR_MENU,
  SIDEBAR_MENU_ITEM,
  type SidebarMenuButtonVariant,
  type SidebarMenuButtonSize,
} from "../generated/sidebar";

export type { SidebarMenuButtonVariant, SidebarMenuButtonSize };

// omitted: mobile sheet, cookie, kbd shortcut — see README Limitations

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "3rem";

interface SidebarContextValue {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider.");
  return ctx;
}

export interface SidebarProviderProps extends React.ComponentProps<"div"> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const [open, setOpen] = useControllableState<boolean>({
    ...(openProp !== undefined ? { value: openProp } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  const toggleSidebar = React.useCallback(
    () => setOpen(!open),
    [open, setOpen],
  );
  const state = open ? "expanded" : "collapsed";

  const contextValue = React.useMemo<SidebarContextValue>(
    () => ({ state, open, setOpen, toggleSidebar }),
    [state, open, setOpen, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn(SIDEBAR_WRAPPER, className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export interface SidebarProps extends React.ComponentProps<"div"> {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
}

export function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: SidebarProps) {
  const { state } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(SIDEBAR_FLAT, className)}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className="group peer text-sidebar-foreground hidden md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      <div
        data-slot="sidebar-inner"
        className={cn(SIDEBAR_INNER, className)}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function SidebarTrigger({
  className,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      aria-label="Toggle Sidebar"
      className={cn(SIDEBAR_TRIGGER, className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      {children}
      <span className="sr-only">Toggle Sidebar</span>
    </button>
  );
}

export function SidebarRail({
  className,
  ...props
}: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(SIDEBAR_RAIL, className)}
      {...props}
    />
  );
}

export function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(SIDEBAR_INSET, className)}
      {...props}
    />
  );
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn(SIDEBAR_HEADER, className)}
      {...props}
    />
  );
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn(SIDEBAR_FOOTER, className)}
      {...props}
    />
  );
}

export function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-separator"
      data-sidebar="separator"
      role="separator"
      className={cn(SIDEBAR_SEPARATOR, className)}
      {...props}
    />
  );
}

export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(SIDEBAR_CONTENT, className)}
      {...props}
    />
  );
}

export function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn(SIDEBAR_GROUP, className)}
      {...props}
    />
  );
}

export interface SidebarGroupLabelProps extends React.ComponentProps<"div"> {
  asChild?: boolean;
}

export function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: SidebarGroupLabelProps) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(SIDEBAR_GROUP_LABEL, className)}
      {...(props as Record<string, unknown>)}
    />
  );
}

export function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn(SIDEBAR_GROUP_CONTENT, className)}
      {...props}
    />
  );
}

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn(SIDEBAR_MENU, className)}
      {...props}
    />
  );
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn(SIDEBAR_MENU_ITEM, className)}
      {...props}
    />
  );
}

export interface SidebarMenuButtonProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
  isActive?: boolean;
  variant?: SidebarMenuButtonVariant;
  size?: SidebarMenuButtonSize;
}

export function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  className,
  ...props
}: SidebarMenuButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        SIDEBAR_MENU_BUTTON_BASE,
        sidebarMenuButtonVariantClasses[variant],
        sidebarMenuButtonSizeClasses[size],
        className,
      )}
      {...(props as Record<string, unknown>)}
    />
  );
}
