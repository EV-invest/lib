import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useFocusScope } from "../primitives/focus-scope";
import { Portal } from "../primitives/portal";

interface CommandContextValue {
  search: string;
  setSearch: (next: string) => void;
}

const CommandContext = React.createContext<CommandContextValue | null>(null);

function useCommand(): CommandContextValue {
  const ctx = React.useContext(CommandContext);
  if (!ctx) throw new Error("Command parts must be used within <Command>");
  return ctx;
}

export interface CommandProps extends React.ComponentProps<"div"> {
  search?: string;
  defaultSearch?: string;
  onSearchChange?: (search: string) => void;
}

export function Command({
  className,
  search,
  defaultSearch = "",
  onSearchChange,
  children,
  ...props
}: CommandProps) {
  const [currentSearch, setSearch] = useControllableState<string>({
    ...(search !== undefined ? { value: search } : {}),
    defaultValue: defaultSearch,
    ...(onSearchChange ? { onChange: onSearchChange } : {}),
  });
  return (
    <CommandContext.Provider value={{ search: currentSearch, setSearch }}>
      <div
        data-slot="command"
        className={cn(
          "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </CommandContext.Provider>
  );
}

export interface CommandDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children?: React.ReactNode;
}

export function CommandDialog({
  open,
  defaultOpen = false,
  onOpenChange,
  className,
  children,
}: CommandDialogProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  const scopeRef = useFocusScope(isOpen);
  if (!isOpen) return null;
  return (
    <Portal>
      <div
        data-slot="command-overlay"
        className="fixed inset-0 z-50 bg-black/50"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        data-slot="command-dialog"
        ref={scopeRef}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border p-0 shadow-lg",
          className,
        )}
      >
        <Command className="[&_[data-slot=command-input-wrapper]]:h-12 [&_[data-slot=command-input]]:h-12">
          {children}
        </Command>
      </div>
    </Portal>
  );
}

export function CommandInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  const { search, setSearch } = useCommand();
  return (
    <div className="flex h-9 items-center gap-2 border-b px-3" data-slot="command-input-wrapper">
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
        className="size-4 shrink-0 opacity-50"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        role="combobox"
        data-slot="command-input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={cn(
          "placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function CommandList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="listbox"
      data-slot="command-list"
      className={cn("max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto", className)}
      {...props}
    />
  );
}

export function CommandEmpty({ className, children, ...props }: React.ComponentProps<"div">) {
  const { search } = useCommand();
  const hasQuery = search.trim() !== "";
  if (!hasQuery) return null;
  return (
    <div
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CommandGroupProps extends React.ComponentProps<"div"> {
  heading?: string;
}

export function CommandGroup({ className, heading, children, ...props }: CommandGroupProps) {
  return (
    <div
      role="group"
      data-slot="command-group"
      className={cn(
        "text-foreground [&_[data-slot=command-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[data-slot=command-group-heading]]:px-2 [&_[data-slot=command-group-heading]]:py-1.5 [&_[data-slot=command-group-heading]]:text-xs [&_[data-slot=command-group-heading]]:font-medium",
        className,
      )}
      {...props}
    >
      {heading ? <div data-slot="command-group-heading">{heading}</div> : null}
      {children}
    </div>
  );
}

export interface CommandItemProps
  extends Omit<React.ComponentProps<"div">, "onSelect"> {
  value: string;
  disabled?: boolean;
  onSelect?: (value: string) => void;
}

export function CommandItem({
  className,
  value,
  disabled = false,
  onSelect,
  children,
  ...props
}: CommandItemProps) {
  const { search } = useCommand();
  const query = search.toLowerCase();
  if (query !== "" && !value.toLowerCase().includes(query)) return null;
  return (
    <div
      role="option"
      data-slot="command-item"
      data-disabled={disabled}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      onClick={() => {
        if (!disabled) onSelect?.(value);
      }}
      className={cn(
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CommandSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-separator"
      className={cn("bg-border -mx-1 h-px", className)}
      {...props}
    />
  );
}

export function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
      {...props}
    />
  );
}
