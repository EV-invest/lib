import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { BottomTabBar } from "../src/components/bottom-tab-bar";
import type { NavItem } from "../src/components/nav-model";

const FakeLink = ({ onClick, ...props }: React.ComponentProps<"a">) => (
  <a
    data-fake-link=""
    {...props}
    onClick={(e) => {
      onClick?.(e);
      e.preventDefault();
    }}
  />
);

const TABS: NavItem[] = [
  { id: "home", href: "/", label: "Home" },
  { id: "invest", href: "/invest", label: "Invest" },
  { id: "wallet", href: "/wallet", label: "Wallet" },
  { id: "account", href: "/settings", label: "Account", also: ["/profile", "/notifications"], badge: 7 },
];

const bar = (pathname: string, extra: Partial<React.ComponentProps<typeof BottomTabBar>> = {}) => (
  <BottomTabBar items={TABS} pathname={pathname} linkComponent={FakeLink} {...extra} />
);

const marker = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-slot="tab-bar-marker"]')!;

describe("BottomTabBar", () => {
  it("lights the tab that claims the path through `also`", () => {
    const { getByRole } = render(bar("/notifications/3"));
    expect(getByRole("link", { name: /Account/ })).toHaveAttribute("aria-current", "page");
    expect(getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("slides one rule by whole tab widths and fades it on an unclaimed route", () => {
    const { container, rerender } = render(bar("/wallet"));
    const rule = marker(container);
    expect(rule.style.translate).toBe("200% 0");
    expect(rule).toHaveAttribute("data-state", "active");
    // one tab wide: a quarter of the bar less its padding (jsdom normalises the calc)
    expect(rule.style.width).toMatch(/0\.25|\/ 4/);
    rerender(bar("/admin"));
    expect(marker(container)).toBe(rule);
    expect(rule).toHaveAttribute("data-state", "idle");
  });

  it("moves the mark on a plain click, before the pathname changes", () => {
    const onNavigate = vi.fn();
    const { container, getByRole } = render(bar("/", { onNavigate }));
    fireEvent.click(getByRole("link", { name: "Invest" }));
    expect(getByRole("link", { name: "Invest" })).toHaveAttribute("aria-current", "page");
    expect(marker(container).style.translate).toBe("100% 0");
    expect(onNavigate).toHaveBeenCalledTimes(1);
    fireEvent.click(getByRole("link", { name: "Wallet" }), { metaKey: true });
    expect(getByRole("link", { name: "Invest" })).toHaveAttribute("aria-current", "page");
  });

  it("puts a numeric badge on the icon's corner and lets labels rename things", () => {
    const { getByRole } = render(
      bar("/", { labels: { nav: "Tabs", badge: (n) => `${n} unread` } }),
    );
    expect(getByRole("navigation", { name: "Tabs" })).toBeInTheDocument();
    const account = getByRole("link", { name: /Account/ });
    expect(account.querySelector('[data-slot="nav-badge"]')).toHaveAttribute("data-variant", "corner");
    expect(account).toHaveTextContent("7 unread");
  });

  it("uses linkComponent for every tab", () => {
    const { getAllByRole } = render(bar("/"));
    for (const link of getAllByRole("link")) expect(link).toHaveAttribute("data-fake-link");
  });
});
