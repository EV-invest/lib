import * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, within } from "@testing-library/react";
import { ShellNav } from "../src/components/shell-nav";
import type { NavGroup } from "../src/components/nav-model";

// Mimics next/link: the caller's onClick runs first, then the link takes the
// click over (which jsdom could not navigate anyway).
const FakeLink = React.forwardRef<HTMLAnchorElement, React.ComponentProps<"a">>(
  function FakeLink({ onClick, ...props }, ref) {
    return (
      <a
        ref={ref}
        data-fake-link=""
        {...props}
        onClick={(e) => {
          onClick?.(e);
          e.preventDefault();
        }}
      />
    );
  },
);

const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;

const GROUPS: NavGroup[] = [
  {
    id: "main",
    label: "Your account",
    items: [
      { id: "home", href: "/", label: "Home", icon: Icon },
      { id: "invest", href: "/invest", label: "Invest", match: "exact" },
      { id: "wallet", href: "/wallet", label: "Wallet" },
    ],
  },
  {
    id: "products",
    label: "Products",
    items: [{ id: "arb", href: "/invest/arb", label: "Arb" }],
  },
];

const FOOTER: NavGroup[] = [
  {
    id: "me",
    items: [
      { id: "profile", href: "/profile", label: "Profile" },
      { id: "inbox", href: "/notifications", label: "Notifications", badge: 150 },
      { id: "help", href: "mailto:help@example.com", label: "Support", external: true },
    ],
  },
];

function nav(pathname: string, extra: Partial<React.ComponentProps<typeof ShellNav>> = {}) {
  return (
    <ShellNav
      groups={GROUPS}
      footerGroups={FOOTER}
      pathname={pathname}
      linkComponent={FakeLink}
      {...extra}
    />
  );
}

const current = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('[aria-current="page"]')).map((el) => el.textContent);

describe("ShellNav", () => {
  it("marks exactly one row current, and only that row", () => {
    const { container } = render(nav("/invest/arb/trade"));
    expect(current(container)).toEqual(["Arb"]);
  });

  it("names both navs and the groups, with overridable labels", () => {
    const { getByRole, rerender } = render(nav("/"));
    expect(getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(getByRole("navigation", { name: "Account" })).toBeInTheDocument();
    expect(getByRole("list", { name: "Your account" })).toBeInTheDocument();
    rerender(nav("/", { labels: { primary: "Primär", footer: "Konto", badge: (n) => `${n} ungelesen` } }));
    expect(getByRole("navigation", { name: "Primär" })).toBeInTheDocument();
    expect(getByRole("navigation", { name: "Konto" })).toBeInTheDocument();
    expect(getByRole("link", { name: /Notifications 150 ungelesen/ })).toBeInTheDocument();
  });

  it("caps the badge at 99+ but speaks the real count", () => {
    const { getByRole } = render(nav("/"));
    const link = getByRole("link", { name: /Notifications/ });
    expect(within(link).getByText("99+")).toHaveAttribute("aria-hidden", "true");
    expect(link).toHaveAccessibleName("Notifications 150 new");
  });

  it("routes in-app items through linkComponent and external ones through a plain <a>", () => {
    const { getByRole } = render(nav("/"));
    expect(getByRole("link", { name: "Wallet" })).toHaveAttribute("data-fake-link");
    expect(getByRole("link", { name: "Support" })).not.toHaveAttribute("data-fake-link");
  });

  it("moves the mark on click, before the pathname changes", () => {
    const onNavigate = vi.fn();
    const { container, getByRole, rerender } = render(nav("/", { onNavigate }));
    fireEvent.click(getByRole("link", { name: "Wallet" }));
    expect(current(container)).toEqual(["Wallet"]);
    expect(getByRole("link", { name: "Wallet" })).toHaveAttribute("data-pending", "true");
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: "wallet" }));
    // the router lands: the URL is the truth again and the pending entry is gone
    rerender(nav("/wallet", { onNavigate }));
    expect(current(container)).toEqual(["Wallet"]);
    expect(getByRole("link", { name: "Wallet" })).not.toHaveAttribute("data-pending");
  });

  it("drops a pending mark the moment the pathname moves elsewhere", () => {
    const { container, getByRole, rerender } = render(nav("/"));
    fireEvent.click(getByRole("link", { name: "Wallet" }));
    rerender(nav("/invest"));
    expect(current(container)).toEqual(["Invest"]);
    rerender(nav("/"));
    expect(current(container)).toEqual(["Home"]);
  });

  it.each([
    ["meta", { metaKey: true }],
    ["ctrl", { ctrlKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
    ["middle button", { button: 1 }],
  ])("leaves the mark alone on a %s click", (_name, init) => {
    const onNavigate = vi.fn();
    const { container, getByRole } = render(nav("/", { onNavigate }));
    fireEvent.click(getByRole("link", { name: "Wallet" }), init);
    expect(current(container)).toEqual(["Home"]);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("reports intent on hover and focus", () => {
    const onItemIntent = vi.fn();
    const { getByRole } = render(nav("/", { onItemIntent }));
    fireEvent.pointerEnter(getByRole("link", { name: "Wallet" }));
    fireEvent.focus(getByRole("link", { name: "Profile" }));
    expect(onItemIntent.mock.calls.map(([i]) => i.id)).toEqual(["wallet", "profile"]);
  });

  it("server-renders the marker unplaced, so the row carries the fill until layout", () => {
    const html = renderToString(nav("/wallet"));
    const host = document.createElement("div");
    host.innerHTML = html;
    const markers = host.querySelectorAll('[data-slot="shell-nav-marker"]');
    expect(markers).toHaveLength(1);
    expect(markers[0]).not.toHaveAttribute("data-placed");
  });

  it("places the marker on mount, and fades it in when it enters another section", () => {
    const { container, rerender } = render(nav("/wallet"));
    const markers = () => container.querySelectorAll<HTMLElement>('[data-slot="shell-nav-marker"]');
    expect(markers()).toHaveLength(1);
    expect(markers()[0]).toHaveAttribute("data-placed", "first");
    rerender(nav("/invest/arb"));
    expect(markers()).toHaveLength(1);
    expect(markers()[0]).toHaveAttribute("data-placed", "entered");
    expect(markers()[0]!.closest('[data-slot="shell-nav-section"]')).toHaveTextContent("Products");
  });

  it("keeps one marker node while the mark moves within a section", () => {
    const { container, rerender } = render(nav("/"));
    const before = container.querySelector('[data-slot="shell-nav-marker"]');
    rerender(nav("/wallet"));
    expect(container.querySelector('[data-slot="shell-nav-marker"]')).toBe(before);
    expect(before).toHaveAttribute("data-placed", "first");
  });

  it("renders the header and footer slots, and lets renderItem replace a row's content", () => {
    const { getByText, getByRole } = render(
      nav("/wallet", {
        header: <span>ACME</span>,
        footer: <button type="button">Sign out</button>,
        renderItem: (item, state) => `${String(item.label)}${state.active ? " *" : ""}`,
      }),
    );
    expect(getByText("ACME")).toBeInTheDocument();
    expect(getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(getByRole("link", { name: "Wallet *" })).toHaveAttribute("aria-current", "page");
  });

  it("hands `trailing` the row's state", () => {
    const groups: NavGroup[] = [
      {
        id: "g",
        items: [
          {
            id: "kyc",
            href: "/kyc",
            label: "Profile",
            trailing: ({ active }) => <span>{active ? "on" : "off"}</span>,
          },
        ],
      },
    ];
    const { getByText } = render(<ShellNav groups={groups} pathname="/kyc" />);
    expect(getByText("on")).toBeInTheDocument();
  });
});
