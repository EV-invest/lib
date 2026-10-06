import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, within } from "@testing-library/react";
import { AccountMenu } from "../src/components/account-menu";

const open = (ui: React.ReactElement) => {
  const view = render(ui);
  fireEvent.click(view.getByRole("button", { name: "Account" }));
  return { ...view, menu: view.getByRole("menu") };
};

describe("AccountMenu", () => {
  it("keeps the fixed order around the service's groups", () => {
    const { menu } = open(
      <AccountMenu
        account={{ name: "Valera Admin", email: "va@example.com" }}
        manageHref="https://id.example.com/settings"
        switchHref="/auth/login?prompt=select_account"
        groups={[{ id: "sa", items: [{ id: "account", href: "/account", label: "Account" }] }]}
        onSignOut={() => {}}
      />,
    );
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map(i => [i.textContent, i.getAttribute("href")])).toEqual([
      ["Manage account", "https://id.example.com/settings"],
      ["Account", "/account"],
      ["Switch account", "/auth/login?prompt=select_account"],
      ["Sign out", null],
    ]);
    expect(menu).toHaveTextContent(/^Valera Adminva@example\.com/);
  });

  it("draws initials, and offers no account center it was not given", () => {
    const { getByRole, menu } = open(
      <AccountMenu account={{ email: "zed@example.com" }} switchHref="/switch" onSignOut={() => {}} />,
    );
    expect(getByRole("button", { name: "Account" })).toHaveTextContent("Z");
    expect(within(menu).queryByText("Manage account")).toBeNull();
  });

  it("signs out and closes", () => {
    const onSignOut = vi.fn();
    const { menu, queryByRole } = open(
      <AccountMenu account={{ name: "Ann", email: "a@example.com" }} switchHref="/s" onSignOut={onSignOut} />,
    );
    fireEvent.click(within(menu).getByText("Sign out"));
    expect(onSignOut).toHaveBeenCalledOnce();
    expect(queryByRole("menu")).toBeNull();
  });
});
