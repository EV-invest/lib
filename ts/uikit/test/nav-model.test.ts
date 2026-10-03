import { describe, expect, it } from "vitest";
import {
  isNavItemActive,
  resolveActiveNavItem,
  type NavItem,
} from "../src/components/nav-model";

const item = (id: string, href: string, extra: Partial<NavItem> = {}): NavItem => ({
  id,
  href,
  label: id,
  ...extra,
});

describe("isNavItemActive", () => {
  it("prefix-matches on a segment boundary by default", () => {
    const invest = item("invest", "/invest");
    expect(isNavItemActive(invest, "/invest")).toBe(true);
    expect(isNavItemActive(invest, "/invest/arb/trade")).toBe(true);
    expect(isNavItemActive(invest, "/investors")).toBe(false);
  });

  it("treats a root item as exact, or it would claim every page", () => {
    const home = item("home", "/");
    expect(isNavItemActive(home, "/")).toBe(true);
    expect(isNavItemActive(home, "/wallet")).toBe(false);
  });

  it("matches `exact` only on the item's own path", () => {
    const invest = item("invest", "/invest", { match: "exact" });
    expect(isNavItemActive(invest, "/invest")).toBe(true);
    expect(isNavItemActive(invest, "/invest/arb")).toBe(false);
  });

  it("defers to a function match", () => {
    const odd = item("odd", "/x", { match: (p) => p.endsWith("/odd") });
    expect(isNavItemActive(odd, "/anything/odd")).toBe(true);
    expect(isNavItemActive(odd, "/x")).toBe(false);
  });

  it("claims the `also` paths by prefix", () => {
    const account = item("account", "/settings", { also: ["/profile", "/notifications"] });
    expect(isNavItemActive(account, "/settings/security")).toBe(true);
    expect(isNavItemActive(account, "/profile")).toBe(true);
    expect(isNavItemActive(account, "/notifications/42")).toBe(true);
    expect(isNavItemActive(account, "/profiles")).toBe(false);
  });

  it("ignores the query, the hash and a trailing slash", () => {
    const settings = item("settings", "/settings?section=security#top");
    expect(isNavItemActive(settings, "/settings/")).toBe(true);
    expect(isNavItemActive(settings, "/settings?section=other")).toBe(true);
  });

  it("never activates an external or disabled item", () => {
    expect(isNavItemActive(item("help", "/help", { external: true }), "/help")).toBe(false);
    expect(isNavItemActive(item("soon", "/soon", { disabled: true }), "/soon")).toBe(false);
  });
});

describe("resolveActiveNavItem", () => {
  it("picks ONE item when prefixes overlap: the longest claim wins", () => {
    const items = [item("invest", "/invest"), item("arb", "/invest/arb")];
    expect(resolveActiveNavItem(items, "/invest/arb/trade")?.id).toBe("arb");
    expect(resolveActiveNavItem(items, "/invest/other")?.id).toBe("invest");
  });

  it("ranks an exact hit above any prefix", () => {
    const items = [item("wide", "/a", { also: ["/a/b"] }), item("exact", "/a/b")];
    expect(resolveActiveNavItem(items, "/a/b")?.id).toBe("exact");
  });

  it("breaks a tie towards the first item", () => {
    const items = [item("first", "/dup"), item("second", "/dup")];
    expect(resolveActiveNavItem(items, "/dup/x")?.id).toBe("first");
  });

  it("returns undefined on a route no item claims", () => {
    expect(resolveActiveNavItem([item("home", "/")], "/admin")).toBeUndefined();
  });
});
