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

export function CommandEmpty({ className, children, ...props }: React.ComponentProps<"div">) {
  const { search } = useCommand();
  const hasQuery = search.trim() !== "";
  if (!hasQuery) return null;
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
