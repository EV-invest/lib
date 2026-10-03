"use client";

import * as React from "react";
import { anchorTargetProps, isPlainLeftClick, type NavItem } from "./nav-model";

export interface NavLinkCallbacks {
  /** Hover or focus on an item — the moment to prefetch its route. */
  onItemIntent?: ((item: NavItem) => void) | undefined;
  /** A plain left click on an in-app item, after it is marked pending. */
  onNavigate?: ((item: NavItem) => void) | undefined;
}

interface NavLinkProps extends NavLinkCallbacks {
  item: NavItem;
  current: boolean;
  pending: boolean;
  linkComponent: React.ElementType | undefined;
  markPending: (id: string) => void;
  className: string;
  title?: string | undefined;
  children: React.ReactNode;
}

/**
 * The anchor (or the disabled stand-in) under a rail row and a tab: picks the
 * element, wires the optimistic mark and the intent/navigate callbacks, and
 * carries `aria-current`, which is also what the rail's marker measures.
 */
export function NavLink({
  item,
  current,
  pending,
  linkComponent,
  markPending,
  onItemIntent,
  onNavigate,
  className,
  title,
  children,
}: NavLinkProps) {
  if (item.disabled) {
    return (
      <span data-slot="nav-link" aria-disabled="true" title={title} className={className}>
        {children}
      </span>
    );
  }
  const Comp: React.ElementType = item.external ? "a" : (linkComponent ?? "a");
  const intent = onItemIntent && (() => onItemIntent(item));
  return (
    <Comp
      data-slot="nav-link"
      data-pending={pending ? "true" : undefined}
      href={item.href}
      title={title}
      aria-current={current ? "page" : undefined}
      className={className}
      onPointerEnter={intent}
      onFocus={intent}
      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
        if (item.external || !isPlainLeftClick(e)) return;
        markPending(item.id);
        onNavigate?.(item);
      }}
      {...anchorTargetProps(item)}
    >
      {children}
    </Comp>
  );
}

/** The row's tooltip: the label itself when it is plain text, so a truncated one stays readable. */
export function labelTitle(label: React.ReactNode): string | undefined {
  return typeof label === "string" ? label : undefined;
}
