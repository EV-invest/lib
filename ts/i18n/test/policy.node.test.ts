import { describe, expect, it } from "vitest";
import { translator } from "../src/index.js";
import { availableIn, resolveCatalogue } from "../src/policy/index.js";

const en = {
  "nav.team": "Team",
  "hero.title": "Invest in Quy Nhon",
  "cart.items": "{n, plural, one {# item} other {# items}}",
  "greet": "Hello {name}",
};

describe("rule 1.1 — English is canonical", () => {
  it("returns the source untouched for the default locale", () => {
    const r = resolveCatalogue("en", en, {});
    expect(r.messages).toBe(en);
    expect(r.coverage).toBe(1);
  });

  it("refuses a key English does not define", () => {
    const r = resolveCatalogue("ru", en, {
      "nav.rogue": { en: "Rogue", t: "Изгой" },
    });
    expect(r.rejected).toContainEqual(
      expect.objectContaining({ key: "nav.rogue", reason: "orphan-key" })
    );
    expect(r.messages["nav.rogue"]).toBeUndefined();
  });

  it("serves English for a key no translation exists for", () => {
    const r = resolveCatalogue("ru", en, {});
    expect(r.messages["nav.team"]).toBe("Team");
    expect(r.missing).toContain("nav.team");
    expect(r.coverage).toBe(0);
  });
});

describe("rule 1.2 — a translation that drifted from its source is not used", () => {
  it("accepts a translation whose source still matches", () => {
    const r = resolveCatalogue("ru", en, {
      "nav.team": { en: "Team", t: "Команда" },
    });
    expect(r.messages["nav.team"]).toBe("Команда");
    expect(r.rejected).toEqual([]);
  });

  it("falls back to English once the source moves underneath it", () => {
    // The failure this whole rule exists for: English was reworded, the
    // translation was not, and the stale claim would otherwise keep shipping.
    const moved = { ...en, "hero.title": "Invest in coastal Vietnam" };
    const r = resolveCatalogue("ru", moved, {
      "hero.title": { en: "Invest in Quy Nhon", t: "Инвестируйте в Куинён" },
    });
    expect(r.messages["hero.title"]).toBe("Invest in coastal Vietnam");
    expect(r.rejected[0]).toMatchObject({
      key: "hero.title",
      reason: "source-drift",
    });
  });

  it("never leaves a hole — every source key is present either way", () => {
    const moved = { ...en, "hero.title": "Something else" };
    const r = resolveCatalogue("ru", moved, {
      "hero.title": { en: "Invest in Quy Nhon", t: "Инвестируйте в Куинён" },
    });
    for (const key of Object.keys(moved)) expect(r.messages[key]).toBeDefined();
    // A page cannot break because a translation went stale.
    expect(translator(r.messages, "ru")("hero.title")).toBe("Something else");
  });

  it("refuses a blank translation", () => {
    const r = resolveCatalogue("ru", en, { "nav.team": { en: "Team", t: "   " } });
    expect(r.rejected[0]?.reason).toBe("empty");
    expect(r.messages["nav.team"]).toBe("Team");
  });
});

describe("rule 1.2 — structural equivalence", () => {
  it("refuses a translation that drops a placeholder", () => {
    const r = resolveCatalogue("ru", en, {
      greet: { en: "Hello {name}", t: "Привет" },
    });
    expect(r.rejected[0]?.reason).toBe("placeholder-mismatch");
    expect(r.messages["greet"]).toBe("Hello {name}");
  });

  it("refuses a translation that invents a placeholder", () => {
    const r = resolveCatalogue("ru", en, {
      greet: { en: "Hello {name}", t: "Привет {имя}" },
    });
    expect(r.rejected[0]?.reason).toBe("placeholder-mismatch");
  });

  it("refuses a plural rendered as a plain value", () => {
    const r = resolveCatalogue("ru", en, {
      "cart.items": { en: en["cart.items"], t: "{n} товаров" },
    });
    expect(r.rejected[0]?.reason).toBe("argument-type-mismatch");
  });

  it("refuses a Russian plural that only mirrors English's two branches", () => {
    // The arithmetic teeth. English needs one/other; Russian needs one/few/many
    // /other. Mirroring English is provably not equivalent, and 3 and 8 are the
    // numbers that expose it.
    const r = resolveCatalogue("ru", en, {
      "cart.items": {
        en: en["cart.items"],
        t: "{n, plural, one {# товар} few {# товара}}",
      },
    });
    expect(r.rejected[0]).toMatchObject({
      key: "cart.items",
      reason: "plural-category-missing",
    });
    expect(r.rejected[0]?.detail).toContain("many");
  });

  it("refuses a Russian plural that mirrors English's one/other exactly", () => {
    // The realistic failure, and the one the `other`-as-wildcard escape used to
    // let through: a translator carries English's two branches across verbatim.
    // It renders — `other` catches few and many — which is precisely why the
    // runtime cannot flag it. "5 товара" is not Russian.
    const r = resolveCatalogue("ru", en, {
      "cart.items": {
        en: en["cart.items"],
        t: "{n, plural, one {# товар} other {# товара}}",
      },
    });
    expect(r.rejected[0]).toMatchObject({
      key: "cart.items",
      reason: "plural-category-missing",
    });
    expect(r.rejected[0]?.detail).toContain("few");
    expect(r.rejected[0]?.detail).toContain("many");
  });

  it("accepts a bare `other` only where the locale declares nothing else", () => {
    // Vietnamese has no plural inflection, so one branch is the whole rule.
    const vi = resolveCatalogue("vi", en, {
      "cart.items": { en: en["cart.items"], t: "{n, plural, other {# món}}" },
    });
    expect(vi.rejected).toEqual([]);

    // Russian gets no such exemption, even though the formatter would fall back
    // to `other` at runtime for every count.
    const ru = resolveCatalogue("ru", en, {
      "cart.items": { en: en["cart.items"], t: "{n, plural, other {# товаров}}" },
    });
    expect(ru.rejected[0]?.reason).toBe("plural-category-missing");
  });

  it("accepts a Russian plural that covers every category", () => {
    const r = resolveCatalogue("ru", en, {
      "cart.items": {
        en: en["cart.items"],
        t: "{n, plural, one {# товар} few {# товара} many {# товаров} other {# товара}}",
      },
    });
    expect(r.rejected).toEqual([]);
    const t = translator(r.messages, "ru");
    expect(t("cart.items", { n: 1 })).toBe("1 товар");
    expect(t("cart.items", { n: 3 })).toBe("3 товара");
    expect(t("cart.items", { n: 8 })).toBe("8 товаров");
  });

  it("does not mistake an escaped brace for a placeholder", () => {
    const source = { literal: "a '{' brace" };
    const r = resolveCatalogue("ru", source, {
      literal: { en: "a '{' brace", t: "скобка '{'" },
    });
    expect(r.rejected).toEqual([]);
    expect(r.messages["literal"]).toBe("скобка '{'");
  });
});

describe("coverage", () => {
  it("reports the share actually served in the locale", () => {
    const r = resolveCatalogue("ru", en, {
      "nav.team": { en: "Team", t: "Команда" },
      greet: { en: "Hello {name}", t: "Привет {name}" },
    });
    expect(r.coverage).toBeCloseTo(2 / 4);
  });
});

describe("rule 1.3 — untranslated compiled content is hidden", () => {
  const items = [
    { slug: "a", locales: ["en", "ru"] as const },
    { slug: "b", locales: ["en"] as const },
  ];

  it("hides what this locale has no translation for", () => {
    expect(availableIn("ru", items, i => i.locales).map(i => i.slug)).toEqual(["a"]);
  });

  it("shows everything in the canonical locale", () => {
    expect(availableIn("en", items, i => i.locales)).toHaveLength(2);
  });

  it("can fall back instead, for collections where hiding costs more", () => {
    // Vacancies: an open role is worth more than a consistent language.
    expect(availableIn("ru", items, i => i.locales, "fallback")).toHaveLength(2);
  });

  it("treats an item that declares no locales as untranslated", () => {
    const undeclared = [{ slug: "c" }];
    expect(availableIn("ru", undeclared, () => undefined)).toEqual([]);
  });
});
