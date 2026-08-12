import { describe, expect, it } from "vitest";

import { LOCALES } from "../src/index";
import {
  localeAlternatesMetadata,
  localeRedirects,
  localeRewrites,
  localeStaticParams,
} from "../src/next/index";

describe("localeStaticParams", () => {
  it("includes the default locale", () => {
    // Unprefixed URLs rewrite onto /en/*, so /en/* must be a real prerendered
    // route even though no reader ever sees that URL.
    expect(localeStaticParams()).toContainEqual({ locale: "en" });
    expect(localeStaticParams()).toHaveLength(LOCALES.length);
  });

  it("ignores whatever Next passes it", () => {
    // Meant to be used as `export const generateStaticParams =
    // localeStaticParams`, and Next calls that with a props object. An earlier
    // signature took a `locales` array in that first slot, so the direct
    // assignment failed to typecheck — and at runtime would have fed
    // `{ params }` straight into the locale list. Arguments are ignored by
    // construction now, so the assignment is safe in both respects.
    const asNextCallsIt = localeStaticParams as unknown as (
      props: unknown
    ) => unknown;
    expect(asNextCallsIt({ params: { locale: "ru" } })).toEqual(
      localeStaticParams()
    );
  });
});

describe("localeRewrites", () => {
  it("maps unprefixed paths onto the default locale", () => {
    expect(localeRewrites()).toEqual([
      { source: "/:path*", destination: "/en/:path*" },
    ]);
  });

  it("is a catch-all, which is why it belongs in `fallback` and not `afterFiles`", () => {
    // Documented as a test because the wrong hook half-works: afterFiles runs
    // before dynamic routes, so it rewrites /ru/team -> /en/ru/team (404) while
    // /team still resolves and hides the bug. The rule below matches ANY path —
    // safe only when it runs last, after dynamic routes have had their chance.
    const [rule] = localeRewrites();
    expect(rule?.source).toBe("/:path*");
    expect(rule?.destination.startsWith("/en/")).toBe(true);
  });
});

describe("localeRedirects", () => {
  it("collapses the explicit /en form and its bare root", () => {
    const rules = localeRedirects();
    expect(rules).toContainEqual({
      source: "/en/:path*",
      destination: "/:path*",
      permanent: true,
    });
    expect(rules).toContainEqual({
      source: "/en",
      destination: "/",
      permanent: true,
    });
  });

  it("cannot loop with the rewrite: no redirect source matches an unprefixed path", () => {
    // The rewrite is internal, so the redirect pipeline never sees /en/team
    // again. Pin the property that makes that safe — every redirect source is
    // itself prefixed.
    for (const rule of localeRedirects()) {
      expect(rule.source.startsWith("/en")).toBe(true);
    }
  });
});

describe("localeAlternatesMetadata", () => {
  const SITE = "https://evinvest.ltd";

  it("emits a self-referential canonical for the rendered locale", () => {
    expect(localeAlternatesMetadata("ru", "/team", SITE).canonical).toBe(
      "https://evinvest.ltd/ru/team",
    );
    expect(localeAlternatesMetadata("en", "/team", SITE).canonical).toBe(
      "https://evinvest.ltd/team",
    );
  });

  it("emits absolute, distinct URLs plus x-default", () => {
    const { languages } = localeAlternatesMetadata("en", "/team", SITE);
    expect(languages["ru"]).toBe("https://evinvest.ltd/ru/team");
    expect(languages["x-default"]).toBe("https://evinvest.ltd/team");
    for (const url of Object.values(languages)) {
      expect(url.startsWith("https://")).toBe(true);
    }
    // Every locale distinct; x-default duplicates en by design.
    expect(new Set(Object.values(languages)).size).toBe(LOCALES.length);
  });

  it("tolerates a trailing slash on the origin", () => {
    expect(localeAlternatesMetadata("en", "/team", "https://evinvest.ltd/").canonical).toBe(
      "https://evinvest.ltd/team",
    );
  });
});
