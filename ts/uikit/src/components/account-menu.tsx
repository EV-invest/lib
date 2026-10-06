"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { Avatar, AvatarFallback } from "./avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import type { NavGroup } from "./nav-model";

export interface AccountMenuLabels {
  /** Accessible name of the trigger. Default `"Account"`. */
  trigger?: string;
  /** Default `"Manage account"`. */
  manage?: string;
  /** Default `"Switch account"`. */
  switchAccount?: string;
  /** Default `"Sign out"`. */
  signOut?: string;
}

export interface AccountMenuProps {
  account: { name?: string | null | undefined; email: string };
  /** The account center, on the identity provider's origin; no item without it. */
  manageHref?: string | undefined;
  /** A full page load to the sign-in that offers the account chooser. */
  switchHref: string;
  /** The service's own entries, between the account center and switching. Draws `label`, `icon`, `external`. */
  groups?: readonly NavGroup[];
  onSignOut: () => void;
  linkComponent?: React.ElementType;
  labels?: AccountMenuLabels;
  className?: string;
}

const initials = (account: AccountMenuProps["account"]) => {
  const words = account.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const letters = words.length > 0 ? words.slice(0, 2).map(w => Array.from(w)[0]) : [Array.from(account.email)[0]];
  return letters.join("").toUpperCase();
};

/**
 * Who is signed in, top right. The order is fixed — the account, the account
 * center, the service's groups, switching, signing out — so every service's
 * menu reads the same; a service adds groups and nothing else.
 */
export function AccountMenu({
  account,
  manageHref,
  switchHref,
  groups = [],
  onSignOut,
  linkComponent,
  labels = {},
  className,
}: AccountMenuProps) {
  const Link = linkComponent ?? "a";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-slot="account-menu-trigger"
        aria-label={labels.trigger ?? "Account"}
        className={cn("rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      >
        <Avatar>
          <AvatarFallback className="text-xs font-medium text-ink">{initials(account)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col">
          {account.name && <span className="truncate text-ink">{account.name}</span>}
          <span className="truncate font-normal text-ink-soft">{account.email}</span>
        </DropdownMenuLabel>
        {manageHref && (
          <DropdownMenuItem asChild>
            <a href={manageHref}>{labels.manage ?? "Manage account"}</a>
          </DropdownMenuItem>
        )}
        {groups.map(group => (
          <React.Fragment key={group.id}>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {group.label && <DropdownMenuLabel className="text-xs text-ink-soft">{group.label}</DropdownMenuLabel>}
              {group.items.map(item => {
                const Item = item.external ? "a" : Link;
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.id} asChild>
                    <Item href={item.href}>
                      {Icon && <Icon className="size-4" />}
                      {item.label}
                    </Item>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </React.Fragment>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={switchHref}>{labels.switchAccount ?? "Switch account"}</a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSignOut}>{labels.signOut ?? "Sign out"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
