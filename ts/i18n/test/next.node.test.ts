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

  it("honours a subset", () => {
    expect(localeStaticParams(["en", "ru"])).toEqual([
      { locale: "en" },
      { locale: "ru" },
    ]);
  });
});

describe("localeRewrites", () => {
  it("maps unprefixed paths onto the default locale", () => {
    expect(localeRewrites()).toEqual([
      { source: "/:path*", destination: "/en/:path*" },
    ]);
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
