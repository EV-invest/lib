"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { SectionLabel } from "./page-frame";

export interface SectionNavItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** A link (`?section=…`, a sub-route) instead of a button calling `onValueChange`. */
  href?: string;
  /** After the label — a count, a status chip. */
  trailing?: React.ReactNode;
  disabled?: boolean;
}

export interface SectionNavGroup {
  id: string;
  label?: React.ReactNode;
  /** One line under the label saying what kind of thing lives here. */
  description?: React.ReactNode;
  items: readonly SectionNavItem[];
}

export interface SectionNavLabels {
  /** Accessible name of the nav. Default `"Sections"`. */
  nav?: string;
}

export interface SectionNavProps extends Omit<React.ComponentProps<"nav">, "children"> {
  groups: readonly SectionNavGroup[];
  /** The current section's id. */
  value: string;
  /** Called by button items (those without `href`), and by link items on click. */
  onValueChange?: (id: string) => void;
  linkComponent?: React.ElementType;
  labels?: SectionNavLabels;
}

const ITEM =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/**
 * A screen's own section rail — settings panes, a document's chapters: grouped
 * rows, one current (`aria-current`), each a button or a link. The shell's rail
 * is `ShellNav`; this one lives inside a page, so it carries a tint rather than
 * the rail's solid marker and does not slide.
 */
export function SectionNav({
  groups,
  value,
  onValueChange,
  linkComponent,
  labels = {},
  className,
  ...props
}: SectionNavProps) {
  return (
    <nav
      data-slot="section-nav"
      aria-label={labels.nav ?? "Sections"}
      className={cn("flex w-60 shrink-0 flex-col gap-5", className)}
      {...props}
    >
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          {(group.label !== undefined || group.description !== undefined) && (
            <div className="mb-1 flex flex-col gap-0.5 px-3">
              {group.label !== undefined && <SectionLabel>{group.label}</SectionLabel>}
              {group.description !== undefined && (
                <p className="text-xs leading-snug text-ink-soft">{group.description}</p>
              )}
            </div>
          )}
          {group.items.map((item) => (
            <SectionNavRow
              key={item.id}
              item={item}
              active={item.id === value}
              onSelect={onValueChange}
              linkComponent={linkComponent}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

function SectionNavRow({
  item,
  active,
  onSelect,
  linkComponent,
}: {
  item: SectionNavItem;
  active: boolean;
  onSelect: ((id: string) => void) | undefined;
  linkComponent: React.ElementType | undefined;
}) {
  const Icon = item.icon;
  const className = cn(
    ITEM,
    active ? "bg-primary-ink/15 font-semibold text-primary-ink" : "text-ink hover:bg-hover",
  );
  const content = (
    <>
      {Icon && <Icon className="size-4.5 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.trailing}
    </>
  );
  if (item.href !== undefined && !item.disabled) {
    const Link = linkComponent ?? "a";
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={className}
        onClick={() => onSelect?.(item.id)}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled={item.disabled}
      aria-current={active ? "true" : undefined}
      className={className}
      onClick={() => onSelect?.(item.id)}
    >
      {content}
    </button>
  );
}
