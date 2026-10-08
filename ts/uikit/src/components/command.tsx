"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { DismissableLayerScope, useDismissableLayer } from "../primitives/dismissable-layer";
import { useFocusScope } from "../primitives/focus-scope";
import { mergeRefs } from "../primitives/merge-refs";
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
  /// matched" from "nothing is here", and its select handler so Enter can fire
  /// it. Items register even while filtered out.
  registerItem: (id: string, value: string, select: () => void) => void;
  unregisterItem: (id: string) => void;
  /// The active query: trimmed, so blank input is not a search, and lowercased.
  /// Shared by the item filter and the empty-state gate so the two can never
  /// disagree.
  query: string;
  /// `null` filters the item out; a number is its CSS `order`, `0` while
  /// nothing is being ranked.
  order: (value: string) => number | null;
  hasMatches: boolean;
  listId: string;
  /// DOM id of the highlighted item. Focus stays in the input and points here
  /// through `aria-activedescendant` (the ARIA combobox pattern), so items
  /// never need to be tabbable.
  activeId: string | null;
  activate: (id: string) => void;
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
  /// `false` hands filtering to the caller (e.g. rows that are a server
  /// response to the query): every mounted item renders, in the caller's
  /// order, and `CommandEmpty` counts mounted items. Defaults to `true`.
  shouldFilter?: boolean;
}

const ITEM_SELECTOR = '[data-slot="command-item"]:not([aria-disabled="true"])';

/// fzf v1: per space-separated term, the shortest window ending at the first
/// full subsequence match, scored for word starts and runs, charged for gaps.
/// `null` when a term does not match.
function fuzzyScore(value: string, query: string): number | null {
  const hay = [...value.toLowerCase()];
  let total = 0;
  for (const term of query.split(/\s+/)) {
    const needle = [...term];
    let k = 0;
    let end = -1;
    for (let i = 0; i < hay.length; i++) {
      if (hay[i] === needle[k] && ++k === needle.length) {
        end = i;
        break;
      }
    }
    if (end < 0) return null;
    let start = end;
    for (let i = end, j = needle.length - 1; j >= 0; i--) {
      if (hay[i] === needle[j]) {
        start = i;
        j--;
      }
    }
    let prev = -1;
    for (let i = start, j = 0; j < needle.length; i++) {
      if (hay[i] !== needle[j]) continue;
      total += 16;
      if (i === 0 || !/[\p{L}\p{N}]/u.test(hay[i - 1]!)) total += 8;
      if (j > 0) total += i === prev + 1 ? 4 : -(3 + (i - prev - 2));
      prev = i;
      j++;
    }
  }
  return total;
}

/// Keyboard highlight over the items currently in the DOM, in the order on
/// screen — each container's rows by their CSS `order`, then DOM order — so it
/// follows whatever the filter (or the caller) rendered rather than the order
/// items happened to register in.
function useCommandNavigation(
  query: string,
  handlers: React.RefObject<Map<string, () => void>>,
) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  // Until the user moves the highlight it tracks the first row, so results
  // that arrive after the keystroke (or reorder under it) put Enter on the top
  // hit. Once moved, it sticks for as long as that row stays.
  const userMoved = React.useRef(false);

  const enabledItems = React.useCallback((): HTMLElement[] => {
    const root = rootRef.current;
    if (!root) return [];
    const byParent = new Map<Element | null, HTMLElement[]>();
    for (const el of root.querySelectorAll<HTMLElement>(ITEM_SELECTOR)) {
      if (el.closest('[data-slot="command"]') !== root) continue;
      const rows = byParent.get(el.parentElement) ?? [];
      rows.push(el);
      byParent.set(el.parentElement, rows);
    }
    return [...byParent.values()].flatMap((rows) =>
      rows.sort((a, b) => Number(a.style.order) - Number(b.style.order)),
    );
  }, []);

  React.useEffect(() => {
    userMoved.current = false;
  }, [query]);

  // No deps on purpose: the caller can change the rendered rows on any render;
  // setting an unchanged id bails out without re-rendering.
  React.useEffect(() => {
    const els = enabledItems();
    const moved = userMoved.current;
    setActiveId((prev) =>
      moved && prev !== null && els.some((el) => el.id === prev)
        ? prev
        : (els[0]?.id ?? null),
    );
  });

  const activate = React.useCallback((id: string) => {
    userMoved.current = true;
    setActiveId(id);
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;
    // Only the search field drives the list: Enter or an arrow on a button
    // inside Command (an action in `CommandEmpty`, a footer) stays its own.
    const field = event.target as HTMLElement;
    if (field.dataset["slot"] !== "command-input") return;
    const els = enabledItems();
    const current = els.findIndex((el) => el.id === activeId);
    const last = els.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = current < 0 ? 0 : Math.min(current + 1, last);
        break;
      case "ArrowUp":
        next = current < 0 ? last : Math.max(current - 1, 0);
        break;
      // Home / End are left to the caret: the field is editable (ARIA APG
      // editable combobox).
      case "Enter": {
        const select =
          activeId !== null && current >= 0
            ? handlers.current.get(activeId)
            : undefined;
        if (select) {
          event.preventDefault();
          select();
        }
        return;
      }
      default:
        return;
    }
    const target = els[next];
    if (!target) return;
    event.preventDefault();
    activate(target.id);
    // Optional call: jsdom implements no `scrollIntoView`.
    target.scrollIntoView?.({ block: "nearest" });
  };

  return { rootRef, activeId, activate, onKeyDown };
}

export function Command({
  className,
  search,
  defaultSearch = "",
  onSearchChange,
  shouldFilter = true,
  children,
  ref,
  onKeyDown,
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
  const handlers = React.useRef(new Map<string, () => void>());
  const registerItem = React.useCallback(
    (id: string, value: string, select: () => void) => {
      handlers.current.set(id, select);
      setItems((prev) => {
        if (prev.get(id) === value) return prev;
        const next = new Map(prev);
        next.set(id, value);
        return next;
      });
    },
    [],
  );
  const unregisterItem = React.useCallback((id: string) => {
    handlers.current.delete(id);
    setItems((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const query = currentSearch.trim().toLowerCase();
  const order = React.useCallback(
    (value: string) => {
      if (!shouldFilter || query === "") return 0;
      const score = fuzzyScore(value, query);
      return score === null ? null : -score;
    },
    [query, shouldFilter],
  );
  const hasMatches = React.useMemo(
    () => [...items.values()].some((value) => order(value) !== null),
    [items, order],
  );

  const listId = React.useId();
  const nav = useCommandNavigation(query, handlers);

  return (
    <CommandContext.Provider
      value={{
        search: currentSearch,
        setSearch,
        registerItem,
        unregisterItem,
        query,
        order,
        hasMatches,
        listId,
        activeId: nav.activeId,
        activate: nav.activate,
      }}
    >
      <div
        data-slot="command"
        ref={mergeRefs(nav.rootRef, ref)}
        className={cn(COMMAND_ROOT, className)}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (!e.defaultPrevented) nav.onKeyDown(e);
        }}
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
  /// See `CommandProps.shouldFilter`.
  shouldFilter?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function CommandDialog({
  open,
  defaultOpen = false,
  onOpenChange,
  shouldFilter = true,
  className,
  children,
}: CommandDialogProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  const scopeRef = useFocusScope(isOpen);
  // Outside clicks stay with the overlay, as in Drawer: it is what "outside" means.
  const dismissRef = useDismissableLayer({
    enabled: isOpen,
    onDismiss: () => setOpen(false),
    pointerOutside: false,
    modal: true,
  });
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
        ref={mergeRefs(scopeRef, dismissRef)}
        className={cn(COMMAND_DIALOG_CONTENT, className)}
      >
        <Command className={COMMAND_DIALOG_COMMAND} shouldFilter={shouldFilter}>
          <DismissableLayerScope layer={dismissRef}>{children}</DismissableLayerScope>
        </Command>
      </div>
    </Portal>
  );
}

export function CommandInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  const { search, setSearch, listId, activeId } = useCommand();
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
        aria-autocomplete="list"
        aria-expanded={true}
        aria-controls={listId}
        aria-activedescendant={activeId ?? undefined}
        autoComplete="off"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={cn(COMMAND_INPUT, className)}
        {...props}
      />
    </div>
  );
}

export function CommandList({ className, ...props }: React.ComponentProps<"div">) {
  const { listId } = useCommand();
  return (
    <div
      role="listbox"
      id={listId}
      data-slot="command-list"
      className={cn(COMMAND_LIST, className)}
      {...props}
    />
  );
}

/// Renders only when a search is under way and no item matched it — never next
/// to results, and never before the user has typed. With `shouldFilter={false}`
/// "matched" means "is mounted": the caller's rows are the results.
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
  id: idProp,
  onPointerMove,
  children,
  ...props
}: CommandItemProps) {
  const { registerItem, unregisterItem, order, activeId, activate } = useCommand();
  const reactId = React.useId();
  // The DOM id is what `aria-activedescendant` points at, so a caller's own id
  // has to be the one registered.
  const id = idProp ?? reactId;
  // Read at select time, so an inline `onSelect` doesn't re-register every render.
  const onSelectRef = React.useRef(onSelect);
  React.useEffect(() => {
    onSelectRef.current = onSelect;
  });
  // Registered whether or not this item survives the filter below, so
  // `CommandEmpty` gates on the search, not on who happens to be mounted.
  React.useEffect(() => {
    registerItem(id, value, () => onSelectRef.current?.(value));
    return () => unregisterItem(id);
  }, [id, value, registerItem, unregisterItem]);

  const rank = order(value);
  if (rank === null) return null;
  const selected = activeId === id;
  return (
    <div
      role="option"
      id={id}
      data-slot="command-item"
      data-disabled={disabled}
      data-selected={selected}
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      onClick={() => {
        if (!disabled) onSelect?.(value);
      }}
      onPointerMove={(e) => {
        onPointerMove?.(e);
        if (!disabled && !selected) activate(id);
      }}
      className={cn(COMMAND_ITEM, className)}
      {...props}
      style={{ ...props.style, order: rank }}
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
