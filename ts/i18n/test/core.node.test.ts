import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_LABELS,
  formatMessage,
  isLocale,
  localeAlternates,
  localeOfElement,
  localePath,
  negotiate,
  splitLocalePath,
  translator,
} from "../src/index";

describe("registry", () => {
  it("uses the ISO 639-1 language code for Vietnamese, not the country code", () => {
    // The chat thread proposed `vn`, which is the ISO 3166 country code. Google
    // discards invalid hreflang values silently, so this is worth pinning.
    expect(LOCALES).toContain("vi");
    expect(LOCALES as readonly string[]).not.toContain("vn");
  });

  it("puts the default locale first", () => {
    expect(LOCALES[0]).toBe(DEFAULT_LOCALE);
  });

  it("labels every locale in its own language", () => {
    for (const locale of LOCALES) {
      expect(LOCALE_LABELS[locale]).toBeTruthy();
    }
    expect(LOCALE_LABELS.ru).toBe("Русский");
  });

  it("guards untrusted input", () => {
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("vn")).toBe(false);
    expect(isLocale("EN")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe("localePath", () => {
  it("leaves the default locale unprefixed", () => {
    expect(localePath("en", "/team")).toBe("/team");
    expect(localePath("en", "/")).toBe("/");
  });

  it("prefixes every other locale", () => {
    expect(localePath("ru", "/team")).toBe("/ru/team");
    expect(localePath("vi", "/hiring/analyst")).toBe("/vi/hiring/analyst");
  });

  it("does not leave a trailing slash on a localised root", () => {
    // "/ru/" and "/ru" are distinct URLs to a crawler; emit one shape.
    expect(localePath("ru", "/")).toBe("/ru");
  });

  it("tolerates a path missing its leading slash", () => {
    expect(localePath("ru", "team")).toBe("/ru/team");
  });
});

describe("splitLocalePath", () => {
  it("round-trips with localePath for every locale", () => {
    for (const locale of LOCALES) {
      for (const path of ["/", "/team", "/hiring/analyst"]) {
        expect(splitLocalePath(localePath(locale, path))).toEqual({ locale, path });
      }
    }
  });

  it("reads an unprefixed path as the default locale", () => {
    expect(splitLocalePath("/team")).toEqual({ locale: "en", path: "/team" });
  });

  it("treats an unrecognised first segment as path, not locale", () => {
    // "/cabinet" must not be read as a locale prefix.
    expect(splitLocalePath("/cabinet/wallet")).toEqual({
      locale: "en",
      path: "/cabinet/wallet",
    });
    expect(splitLocalePath("/vn/team")).toEqual({ locale: "en", path: "/vn/team" });
  });

  it("handles a bare locale prefix", () => {
    expect(splitLocalePath("/ru")).toEqual({ locale: "ru", path: "/" });
  });
});

describe("localeAlternates", () => {
  it("gives each locale its own URL", () => {
    // The bug this guards: site_conductor's sitemap mapped every locale to the
    // same URL, which is a self-contradicting hreflang cluster.
    const alternates = localeAlternates("/team");
    expect(alternates).toEqual({
      en: "/team",
      ru: "/ru/team",
      vi: "/vi/team",
      fr: "/fr/team",
      de: "/de/team",
    });
    expect(new Set(Object.values(alternates)).size).toBe(LOCALES.length);
  });

  it("honours a locale subset", () => {
    expect(localeAlternates("/team", ["en", "ru"])).toEqual({
      en: "/team",
      ru: "/ru/team",
    });
  });
});

describe("negotiate", () => {
  it("matches a regional tag against its base language", () => {
    expect(negotiate("ru-RU,ru;q=0.9,en;q=0.8")).toBe("ru");
  });

  it("respects q-value ordering rather than source order", () => {
    expect(negotiate("de;q=0.2,vi;q=0.9")).toBe("vi");
  });

  it("falls back to the default when nothing matches", () => {
    expect(negotiate("ja,ko;q=0.8")).toBe("en");
    expect(negotiate(null)).toBe("en");
    expect(negotiate("")).toBe("en");
  });

  it("treats q=0 as a refusal", () => {
    expect(negotiate("ru;q=0,de;q=0.5")).toBe("de");
  });

  it("does not return NaN-ranked garbage ahead of a real match", () => {
    expect(negotiate("xx;q=notanumber,ru;q=0.4")).toBe("ru");
  });

  it("honours a locale subset", () => {
    expect(negotiate("ru,en", ["en", "de"])).toBe("en");
  });
});

describe("formatMessage — interpolation", () => {
  it("substitutes named values", () => {
    expect(formatMessage("Hello, {name}.", "en", { name: "Valera" })).toBe(
      "Hello, Valera.",
    );
  });

  it("leaves an unsupplied placeholder visible rather than blanking it", () => {
    expect(formatMessage("Hello, {name}.", "en")).toBe("Hello, {name}.");
  });

  it("keeps apostrophes in ordinary copy", () => {
    // The escape rule must not eat the apostrophes English prose is full of.
    expect(formatMessage("We've got it.", "en")).toBe("We've got it.");
  });

  it("escapes literal braces", () => {
    expect(formatMessage("Use '{'name'}' as the key.", "en")).toBe(
      "Use {name} as the key.",
    );
  });

  it("does not throw on an unbalanced brace", () => {
    expect(formatMessage("Hello, {name", "en", { name: "x" })).toBe("Hello, {name");
  });

  it("keeps a quoted section literal to its closing quote", () => {
    expect(formatMessage("'{name}' is the placeholder", "en", { name: "x" })).toBe(
      "{name} is the placeholder",
    );
  });

  it("renders a doubled quote as one apostrophe", () => {
    expect(formatMessage("it''s fine", "en")).toBe("it's fine");
  });

  it("leaves # literal outside a plural", () => {
    // Only a plural binds #; a hash in ordinary copy is just a hash.
    expect(formatMessage("Ranked #1 in Quy Nhon", "en")).toBe("Ranked #1 in Quy Nhon");
  });
});

describe("formatMessage — plurals", () => {
  const en = "{n, plural, =0 {no roles} one {# role} other {# roles}}";

  it("selects exact, one and other in English", () => {
    expect(formatMessage(en, "en", { n: 0 })).toBe("no roles");
    expect(formatMessage(en, "en", { n: 1 })).toBe("1 role");
    expect(formatMessage(en, "en", { n: 7 })).toBe("7 roles");
  });

  it("resolves all three Russian plural forms", () => {
    // The reason a bare string map is not enough: ru has one/few/many.
    const ru = "{n, plural, one {# вакансия} few {# вакансии} many {# вакансий}}";
    expect(formatMessage(ru, "ru", { n: 1 })).toBe("1 вакансия");
    expect(formatMessage(ru, "ru", { n: 3 })).toBe("3 вакансии");
    expect(formatMessage(ru, "ru", { n: 8 })).toBe("8 вакансий");
    expect(formatMessage(ru, "ru", { n: 21 })).toBe("21 вакансия");
  });

  it("handles Vietnamese, which has a single form", () => {
    const vi = "{n, plural, other {# vị trí}}";
    expect(formatMessage(vi, "vi", { n: 1 })).toBe("1 vị trí");
    expect(formatMessage(vi, "vi", { n: 9 })).toBe("9 vị trí");
  });

  it("formats # in the reader's locale", () => {
    const pattern = "{n, plural, other {# items}}";
    // de groups thousands with a dot.
    expect(formatMessage(pattern, "de", { n: 1234 })).toBe("1.234 items");
    expect(formatMessage(pattern, "en", { n: 1234 })).toBe("1,234 items");
  });

  it("falls back to `other` when the exact category is absent", () => {
    expect(formatMessage("{n, plural, other {# x}}", "ru", { n: 3 })).toBe("3 x");
  });

  it("resolves nested placeholders inside a branch", () => {
    expect(
      formatMessage("{n, plural, other {# roles at {org}}}", "en", {
        n: 2,
        org: "EV",
      }),
    ).toBe("2 roles at EV");
  });

  it("lets a branch escape # to a literal hash", () => {
    expect(formatMessage("{n, plural, other {rank '#'# }}", "en", { n: 3 })).toBe(
      "rank #3 ",
    );
  });

  it("keeps # bound to the enclosing count inside a nested select", () => {
    const pattern =
      "{n, plural, other {{tier, select, fund {# fund units} other {# units}}}}";
    expect(formatMessage(pattern, "en", { n: 4, tier: "fund" })).toBe("4 fund units");
    expect(formatMessage(pattern, "en", { n: 4, tier: "x" })).toBe("4 units");
  });

  it("renders nothing rather than NaN for a non-numeric count", () => {
    expect(formatMessage("{n, plural, other {# x}}", "en", { n: "abc" })).toBe("");
  });
});

describe("formatMessage — select", () => {
  const pattern = "{tier, select, fund {Fund} user {Investor} other {Guest}}";

  it("picks the named branch", () => {
    expect(formatMessage(pattern, "en", { tier: "fund" })).toBe("Fund");
    expect(formatMessage(pattern, "en", { tier: "user" })).toBe("Investor");
  });

  it("falls back to other for an unknown value", () => {
    expect(formatMessage(pattern, "en", { tier: "nope" })).toBe("Guest");
    expect(formatMessage(pattern, "en")).toBe("Guest");
  });
});

describe("translator", () => {
  const messages = {
    "hero.title": "Инвестируйте в нарратив «Китай+1»",
    "cart.items": "{n, plural, one {# товар} few {# товара} many {# товаров} other {# товара}}",
  };

  it("looks up and formats", () => {
    const t = translator(messages, "ru");
    expect(t("hero.title", "Invest in the China+1 narrative")).toBe(
      "Инвестируйте в нарратив «Китай+1»",
    );
    expect(t("cart.items", "{n, plural, one {# item} other {# items}}", { n: 2 })).toBe(
      "2 товара",
    );
  });

  it("renders the inline English when the key is missing, and reports it", () => {
    const onMissing = vi.fn();
    const t = translator(messages, "ru", onMissing);
    expect(t("hero.subtitle", "Five hundred years of compounding")).toBe(
      "Five hundred years of compounding",
    );
    expect(onMissing).toHaveBeenCalledWith("hero.subtitle", "ru");
  });

  it("does not report a key that exists", () => {
    const onMissing = vi.fn();
    translator(messages, "ru", onMissing)("hero.title", "Invest in the China+1 narrative");
    expect(onMissing).not.toHaveBeenCalled();
  });

  it("never consults the catalogue for the default locale", () => {
    const onMissing = vi.fn();
    // English is the authored source: the catalogue is generated back out of
    // these very strings, so a lookup could only ever return what was passed in.
    const t = translator({ "hero.title": "STALE" }, "en", onMissing);
    expect(t("hero.title", "Invest in the China+1 narrative")).toBe(
      "Invest in the China+1 narrative",
    );
    expect(t("anything", "{n, plural, one {# item} other {# items}}", { n: 5 })).toBe("5 items");
    expect(onMissing).not.toHaveBeenCalled();
  });
});

describe("localeOfElement", () => {
  // The structural stand-in for a DOM subtree: `closest` walks up to the
  // nearest ancestor carrying `lang`, exactly as the platform's does.
  const mount = (...langs: (string | null)[]): Parameters<typeof localeOfElement>[0] => {
    const node = (i: number): Parameters<typeof localeOfElement>[0] => ({
      getAttribute: name => (name === "lang" ? (langs[i] ?? null) : null),
      closest: () => {
        for (let up = i; up < langs.length; up++) if (langs[up] != null) return node(up);
        return null;
      },
    });
    return node(0);
  };

  it("reads the nearest lang", () => {
    expect(localeOfElement(mount("ru"))).toBe("ru");
    expect(localeOfElement(mount(null, null, "de"))).toBe("de");
  });

  it("takes the base language of a regional tag", () => {
    expect(localeOfElement(mount("ru-RU"))).toBe("ru");
  });

  it("falls back to the default when there is no lang, or an unpublished one", () => {
    expect(localeOfElement(mount(null))).toBe("en");
    expect(localeOfElement(mount("ja"))).toBe("en");
  });
});
