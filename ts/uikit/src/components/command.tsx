import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useFocusScope } from "../primitives/focus-scope";
import { Portal } from "../primitives/portal";
import {
  COMMAND_DIALOG_COMMAND,
  COMMAND_DIALOG_CONTENT,
  COMMAND_DIALOG_OVERLAY,
  COMMAND_EMPTY,
  COMMAND_GROUP,
  COMMAND_INPUT,
  COMMAND_INPUT_WRAPPER,
  COMMAND_ITEM,
  COMMAND_LIST,
  COMMAND_ROOT,
  COMMAND_SEPARATOR,
  COMMAND_SHORTCUT,
} from "../generated/command";

interface CommandContextValue {
  search: string;
  setSearch: (next: string) => void;
  /// Registers a `CommandItem`'s value so `CommandEmpty` can tell "nothing
  /// matched" from "nothing is here". Items register even while filtered out.
  registerItem: (id: string, value: string) => void;
  unregisterItem: (id: string) => void;
  /// The active query: trimmed, so blank input is not a search, and lowercased.
  /// Shared by the item filter and the empty-state gate so the two can never
  /// disagree.
  query: string;
  matches: (value: string) => boolean;
  hasMatches: boolean;
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

  const [items, setItems] = React.useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const registerItem = React.useCallback((id: string, value: string) => {
    setItems((prev) => {
      if (prev.get(id) === value) return prev;
      const next = new Map(prev);
      next.set(id, value);
      return next;
    });
  }, []);
  const unregisterItem = React.useCallback((id: string) => {
    setItems((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const query = currentSearch.trim().toLowerCase();
  const matches = React.useCallback(
    (value: string) => query === "" || value.toLowerCase().includes(query),
    [query],
  );
  const hasMatches = React.useMemo(
    () => [...items.values()].some(matches),
    [items, matches],
  );

  return (
    <CommandContext.Provider
      value={{
        search: currentSearch,
        setSearch,
        registerItem,
        unregisterItem,
        query,
        matches,
        hasMatches,
      }}
    >
      <div
        data-slot="command"
        className={cn(COMMAND_ROOT, className)}
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
        className={COMMAND_DIALOG_OVERLAY}
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
        className={cn(COMMAND_DIALOG_CONTENT, className)}
      >
        <Command className={COMMAND_DIALOG_COMMAND}>
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
    <div className={COMMAND_INPUT_WRAPPER} data-slot="command-input-wrapper">
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
        className={cn(COMMAND_INPUT, className)}
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
      className={cn(COMMAND_LIST, className)}
      {...props}
    />
  );
}

/// Renders only when a search is under way and no item matched it — never next
/// to results, and never before the user has typed.
export function CommandEmpty({ className, children, ...props }: React.ComponentProps<"div">) {
  const { query, hasMatches } = useCommand();
  if (query === "" || hasMatches) return null;
  return (
    <div
      data-slot="command-empty"
      className={cn(COMMAND_EMPTY, className)}
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
      className={cn(COMMAND_GROUP, className)}
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
  const { registerItem, unregisterItem, matches } = useCommand();
  const id = React.useId();
  // Registered whether or not this item survives the filter below, so
  // `CommandEmpty` gates on the search, not on who happens to be mounted.
  React.useEffect(() => {
    registerItem(id, value);
    return () => unregisterItem(id);
  }, [id, value, registerItem, unregisterItem]);

  if (!matches(value)) return null;
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
      className={cn(COMMAND_ITEM, className)}
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
      className={cn(COMMAND_SEPARATOR, className)}
      {...props}
    />
  );
}

export function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(COMMAND_SHORTCUT, className)}
      {...props}
    />
  );
}
