import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createLocaleRegistry,
  defaultLocaleRegistry,
  languageAlternates,
  LOCALES,
} from "../src/index";
import { translatedLocales, writeCatalogues } from "../src/extract/index";
import { createNextI18n } from "../src/next/index";
import { availableIn, createPolicy, resolveCatalogue } from "../src/policy/index";

// The shape the Service-Arb storefronts need: French first and default, every
// locale prefixed, French advertised to France specifically.
const fr = createLocaleRegistry({
  locales: ["fr", "en"],
  labels: { fr: "Français", en: "English" },
  default: "fr",
  prefixDefaultLocale: true,
  hreflang: { fr: "fr-FR" },
});

const SITE = "https://plombier.example";

describe("createLocaleRegistry — types", () => {
  it("narrows the locale type to the literal union of `locales`", () => {
    const locale: "fr" | "en" = fr.defaultLocale;
    expect(locale).toBe("fr");
    // @ts-expect-error — "de" is not in this registry
    fr.localePath("de", "/x");
  });

  it("rejects a default outside the list, at compile time and at startup", () => {
    expect(() =>
      createLocaleRegistry({
        locales: ["fr", "en"],
        labels: { fr: "Français", en: "English" },
        // @ts-expect-error — "de" is not one of `locales`
        default: "de",
      }),
    ).toThrow(/not in \[fr, en\]/);
  });

  it("rejects a duplicated locale", () => {
    expect(() =>
      createLocaleRegistry({
        locales: ["fr", "fr"],
        labels: { fr: "Français" },
        default: "fr",
      }),
    ).toThrow(/more than once/);
  });

  it("keeps its members bound when destructured", () => {
    const { localePath } = fr;
    expect(localePath("en", "/a")).toBe("/en/a");
  });
});

describe("prefixDefaultLocale: true — paths", () => {
  it("prefixes the default locale too", () => {
    expect(fr.localePath("fr", "/contact")).toBe("/fr/contact");
    expect(fr.localePath("en", "/contact")).toBe("/en/contact");
  });

  it("keeps one canonical root shape per locale", () => {
    expect(fr.localePath("fr", "/")).toBe("/fr");
    expect(fr.localePath("en", "/")).toBe("/en");
  });

  it("normalises a relative path", () => {
    expect(fr.localePath("fr", "contact")).toBe("/fr/contact");
  });

  it("builds root-relative alternates keyed by locale", () => {
    expect(fr.localeAlternates("/contact")).toEqual({ fr: "/fr/contact", en: "/en/contact" });
  });
});

describe("prefixDefaultLocale: true — parsing", () => {
  it("reads the default locale's prefix as a prefix", () => {
    expect(fr.splitLocalePath("/fr/contact")).toEqual({ locale: "fr", path: "/contact" });
    expect(fr.splitLocalePath("/fr")).toEqual({ locale: "fr", path: "/" });
    expect(fr.splitLocalePath("/fr/")).toEqual({ locale: "fr", path: "/" });
  });

  it("reads the other locales", () => {
    expect(fr.splitLocalePath("/en/services/fuite")).toEqual({
      locale: "en",
      path: "/services/fuite",
    });
  });

  it("round-trips every locale through localePath", () => {
    for (const locale of fr.locales) {
      for (const path of ["/", "/contact", "/a/b"]) {
        expect(fr.splitLocalePath(fr.localePath(locale, path))).toEqual({ locale, path });
      }
    }
  });

  it("falls back to the default for an unprefixed or foreign path, never throwing", () => {
    expect(fr.splitLocalePath("/contact")).toEqual({ locale: "fr", path: "/contact" });
    expect(fr.splitLocalePath("/de/contact")).toEqual({ locale: "fr", path: "/de/contact" });
    expect(fr.splitLocalePath("")).toEqual({ locale: "fr", path: "/" });
  });
});

describe("hreflang", () => {
  it("advertises the mapped regional tag, and the bare code otherwise", () => {
    expect(fr.hreflangOf("fr")).toBe("fr-FR");
    expect(fr.hreflangOf("en")).toBe("en");
  });

  it("builds alternates.languages keyed by hreflang, with x-default on the default locale", () => {
    expect(fr.languageAlternates("/contact", SITE)).toEqual({
      "fr-FR": "https://plombier.example/fr/contact",
      en: "https://plombier.example/en/contact",
      "x-default": "https://plombier.example/fr/contact",
    });
  });

  it("tolerates a trailing slash on the origin", () => {
    expect(fr.languageAlternates("/", `${SITE}/`)["x-default"]).toBe("https://plombier.example/fr");
  });

  it("omits x-default for a subset that does not advertise the default", () => {
    expect(fr.languageAlternates("/", SITE, ["en"])).toEqual({ en: "https://plombier.example/en" });
    expect(fr.languageAlternates("/", SITE, ["fr"])).toEqual({
      "fr-FR": "https://plombier.example/fr",
      "x-default": "https://plombier.example/fr",
    });
  });

  it("rejects hreflang tags that collide or claim x-default", () => {
    const labels = { fr: "Français", en: "English" };
    expect(() =>
      createLocaleRegistry({ locales: ["fr", "en"], labels, default: "fr", hreflang: { fr: "fr-FR", en: "FR-fr" } }),
    ).toThrow(/collide/);
    expect(() =>
      createLocaleRegistry({ locales: ["fr", "en"], labels, default: "fr", hreflang: { en: "fr" } }),
    ).toThrow(/collide/);
    expect(() =>
      createLocaleRegistry({ locales: ["fr", "en"], labels, default: "fr", hreflang: { en: "x-default" } }),
    ).toThrow(/reserved/);
  });

  it("supports two regions of one language as distinct locales", () => {
    const be = createLocaleRegistry({
      locales: ["fr", "nl"],
      labels: { fr: "Français", nl: "Nederlands" },
      default: "fr",
      hreflang: { fr: "fr-BE", nl: "nl-BE" },
    });
    expect(be.languageAlternates("/", SITE)).toEqual({
      "fr-BE": "https://plombier.example/",
      "nl-BE": "https://plombier.example/nl",
      "x-default": "https://plombier.example/",
    });
  });
});

describe("negotiation and translation follow the registry's default", () => {
  it("falls back to the registry default", () => {
    expect(fr.negotiate("ja")).toBe("fr");
    expect(fr.negotiate("en-GB,en;q=0.9")).toBe("en");
    expect(fr.negotiate("fr-BE")).toBe("fr");
  });

  it("treats the default locale as the authored source", () => {
    const t = fr.translator({ "cta": "IGNORED" }, "fr");
    expect(t("cta", "Appelez-nous")).toBe("Appelez-nous");
    const en = fr.translator({ "cta": "Call us" }, "en");
    expect(en("cta", "Appelez-nous")).toBe("Call us");
  });

  it("reads lang inheritance against its own list", () => {
    const node = { getAttribute: () => "en-US", closest: () => node };
    expect(fr.localeOfElement(node)).toBe("en");
  });
});

describe("the generated registry is the default instance", () => {
  it("is what the free functions delegate to", () => {
    expect(defaultLocaleRegistry.locales).toEqual(LOCALES);
    expect(defaultLocaleRegistry.prefixDefaultLocale).toBe(false);
    expect(languageAlternates("/team", "https://evinvest.ltd")).toEqual({
      en: "https://evinvest.ltd/team",
      ru: "https://evinvest.ltd/ru/team",
      vi: "https://evinvest.ltd/vi/team",
      fr: "https://evinvest.ltd/fr/team",
      de: "https://evinvest.ltd/de/team",
      "x-default": "https://evinvest.ltd/team",
    });
  });
});

describe("createNextI18n", () => {
  const next = createNextI18n(fr);

  it("prerenders every locale", () => {
    expect(next.localeStaticParams()).toEqual([{ locale: "fr" }, { locale: "en" }]);
  });

  it("needs no fallback rewrite when nothing is served unprefixed", () => {
    expect(next.localeRewrites()).toEqual([]);
  });

  it("sends only the bare root to the default locale, temporarily", () => {
    expect(next.localeRedirects()).toEqual([{ source: "/", destination: "/fr", permanent: false }]);
  });

  it("emits a prefixed canonical and the hreflang cluster", () => {
    expect(next.localeAlternatesMetadata("fr", "/contact", SITE)).toEqual({
      canonical: "https://plombier.example/fr/contact",
      languages: {
        "fr-FR": "https://plombier.example/fr/contact",
        en: "https://plombier.example/en/contact",
        "x-default": "https://plombier.example/fr/contact",
      },
    });
  });

  it("keeps x-default in the metadata for a subset, as it always has", () => {
    expect(next.localeAlternatesMetadata("en", "/", SITE, ["en"]).languages).toEqual({
      en: "https://plombier.example/en",
      "x-default": "https://plombier.example/fr",
    });
  });

  it("keeps the unprefixed scheme for a registry that does not prefix", () => {
    const plain = createNextI18n(
      createLocaleRegistry({
        locales: ["fr", "en"],
        labels: { fr: "Français", en: "English" },
        default: "fr",
      }),
    );
    expect(plain.localeRewrites()).toEqual([{ source: "/:path*", destination: "/fr/:path*" }]);
    expect(plain.localeRedirects()).toContainEqual({
      source: "/fr/:path*",
      destination: "/:path*",
      permanent: true,
    });
  });
});

describe("policy and extract take the registry's source locale", () => {
  it("does not count English as covered when the source is French", () => {
    // The bug a default-registry policy would have: `en` is its source, so an
    // empty English catalogue over French copy reads as 100 % translated.
    const source = { cta: "Appelez-nous" };
    expect(resolveCatalogue("en", source, {}).coverage).toBe(1);

    const policy = createPolicy(fr);
    const en = policy.resolveCatalogue("en", source, {});
    expect(en.coverage).toBe(0);
    expect(en.missing).toEqual(["cta"]);
    expect(en.messages).toEqual(source);
    expect(policy.resolveCatalogue("fr", source, {}).coverage).toBe(1);
  });

  it("names the registry's source locale in rejections", () => {
    const orphan = createPolicy(fr).resolveCatalogue("en", {}, { gone: { en: "x", t: "y" } });
    expect(orphan.rejected[0]?.detail).toMatch(/not defined in fr/);
  });

  it("hides untranslated content from every locale but the registry's source", () => {
    const policy = createPolicy(fr);
    expect(policy.availableIn("fr", ["a"], () => [])).toEqual(["a"]);
    expect(policy.availableIn("en", ["a"], () => [])).toEqual([]);
    expect(policy.availableIn("en", ["a"], () => ["en"])).toEqual(["a"]);
    expect(availableIn("en", ["a"], () => [])).toEqual(["a"]);
  });

  it("writes the default locale's catalogue and prunes the others", () => {
    const messages = mkdtempSync(join(tmpdir(), "i18n-registry-"));
    for (const dir of ["fr", "en", "ru"]) mkdirSync(join(messages, dir));
    writeFileSync(
      join(messages, "en", "common.json"),
      JSON.stringify({ cta: { en: "Appelez-nous", t: "Call us" }, stale: { en: "x", t: "y" } }),
    );

    expect(translatedLocales(messages, fr)).toEqual(["en"]);
    const lines = writeCatalogues(messages, [{ key: "cta", en: "Appelez-nous", where: "a.tsx:1" }], fr);

    expect(lines[0]).toMatch(/^fr: 1 keys/);
    expect(JSON.parse(readFileSync(join(messages, "fr", "common.json"), "utf8"))).toEqual({
      cta: "Appelez-nous",
    });
    expect(Object.keys(JSON.parse(readFileSync(join(messages, "en", "common.json"), "utf8")))).toEqual([
      "cta",
    ]);
  });
});
