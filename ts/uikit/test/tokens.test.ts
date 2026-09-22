import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import { PROGRESS_INDICATOR, PROGRESS_TRACK } from "../src/generated/progress";
import { SLIDER_RANGE, SLIDER_TRACK } from "../src/generated/slider";
import { brandFromToml, readContract, readRules, renderPalette, type CssRule } from "../src/palette";

// The shipped sheet, not the repo-root source: a consumer imports this one.
// Resolved from cwd rather than import.meta.url: jsdom rewrites the module URL
// to http://, which `new URL(...)` then refuses to read from disk. The cwd is
// `ts/uikit` — vitest runs from the package root (`npm test`), which is where
// `styles/tokens.css` resolves; run it from anywhere else and the read fails
// loudly rather than measuring the wrong sheet.
const sheet = readFileSync(join(process.cwd(), "styles/tokens.css"), "utf8");
const contract = readContract(sheet);

/** One set of values a surface can be painted with: a palette in one polarity. */
interface Scope {
  label: string;
  rule: CssRule;
}

function scopeOf(rules: CssRule[], selector: string, label: string): Scope {
  const rule = rules.find((r) => r.selector === selector);
  if (!rule) throw new Error(`no rule \`${selector}\` for ${label}`);
  return { label, rule };
}

const demoBrand = "aquafix-demo";
const demoRules = readRules(
  renderPalette(
    demoBrand,
    brandFromToml(readFileSync(join(process.cwd(), "test/fixtures/aquafix-demo.brand.toml"), "utf8")),
    contract,
  ),
);
const at = `[data-brand="${demoBrand}"]`;

const EV = scopeOf(readRules(sheet), ':where(:root, [data-brand="ev"])', "ev");
// Every palette the kit measures, in every polarity it declares. EV is
// single-polarity: one scope serves both classes.
const scopes: Scope[] = [
  EV,
  scopeOf(demoRules, `${at}, ${at}.light, ${at} .light`, `${demoBrand} light`),
  scopeOf(demoRules, `${at}.dark, ${at} .dark`, `${demoBrand} dark`),
];

/** `--name` as a flat hex in `scope`, following `var(--other)` within it. */
function token(name: string, scope: Scope): string {
  const value = scope.rule.declarations.get(name);
  const ref = value && /^var\(--([a-z0-9-]+)\)$/.exec(value);
  if (ref?.[1]) return token(ref[1], scope);
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`--${name} is not a plain hex token in ${scope.label}`);
  return value.toLowerCase();
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// `bg-x/N` painted over an opaque surface, the way the browser composites it
// in sRGB. Naive alpha lies about contrast; this is the colour that is measured.
function composite(fg: string, alpha: number, bg: string): string {
  const channel = (i: number) => {
    const f = parseInt(fg.slice(i, i + 2), 16);
    const b = parseInt(bg.slice(i, i + 2), 16);
    return Math.round(f * alpha + b * (1 - alpha))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

describe.each(scopes)("palette $label", (scope) => {
  const t = (name: string) => token(name, scope);

  it("declares every name the contract requires", () => {
    const missing = contract.required.filter((name) => !scope.rule.declarations.has(name));
    expect(missing).toEqual([]);
  });

  // The floors docs/spec/accents.md commits to for a role whose fill and ink
  // diverge. Measured, because a retune of one value quietly moves the other.
  describe("primary fill vs ink", () => {
    it("the label reads on the fill (AA text)", () => {
      expect(contrast(t("primary"), t("on-primary"))).toBeGreaterThanOrEqual(4.5);
    });

    it.each(["background", "secondary", "card", "popover"])("the fill reads as a shape on %s (non-text 3:1)", (surface) => {
      expect(contrast(t("primary"), t(surface))).toBeGreaterThanOrEqual(3);
    });

    it.each(["background", "card"])("the ink reads as text on %s (AA text)", (surface) => {
      expect(contrast(t("primary-ink"), t(surface))).toBeGreaterThanOrEqual(4.5);
    });

    it.each(["background", "card"])("body text reads on %s (AA text)", (surface) => {
      expect(contrast(t("ink"), t(surface))).toBeGreaterThanOrEqual(4.5);
    });
  });

  // A track is a shape under a shape, so it owes two floors at once: the moving
  // part reads on it (3:1) and it reads against the plane it sits on (~1.3:1, or
  // the UI goes flat). Both pairs are painted by the class tables, so the classes
  // are asserted alongside the numbers they were chosen for.
  describe("slider and progress tracks", () => {
    it("the slider range is the ink on a muted track", () => {
      expect(SLIDER_RANGE).toMatch(/\bbg-primary-ink\b/);
      expect(SLIDER_TRACK).toMatch(/\bbg-muted\b/);
      expect(contrast(t("primary-ink"), t("muted"))).toBeGreaterThanOrEqual(3);
      expect(contrast(t("muted"), t("card"))).toBeGreaterThanOrEqual(1.3);
    });

    it("the progress indicator is the ink on a 20% tint of itself, composited on card", () => {
      expect(PROGRESS_INDICATOR).toMatch(/\bbg-primary-ink\b/);
      expect(PROGRESS_TRACK).toMatch(/\bbg-primary-ink\/20\b/);
      const track = composite(t("primary-ink"), 0.2, t("card"));
      expect(contrast(t("primary-ink"), track)).toBeGreaterThanOrEqual(3);
      expect(contrast(track, t("card"))).toBeGreaterThanOrEqual(1.3);
    });
  });
});

describe("EV", () => {
  // The documented exception, pinned so it stays one: a fill on muted is
  // identified by its on-primary mark, never as a bare shape. Should a retune
  // ever clear 3:1 here, the spec's list of surfaces is what should change.
  it("the fill is under the floor on muted (the spec's stated exception)", () => {
    expect(contrast(token("primary", EV), token("muted", EV))).toBeLessThan(3);
  });
});

describe("the contract half of the sheet", () => {
  const rules = readRules(sheet);

  it("derives the lines, hover and secondary ink rather than asking a palette for them", () => {
    expect([...contract.derived].sort()).toEqual(["border", "hover", "ink-mid", "ink-soft", "input", "ring"]);
  });

  it("the focus ring is the ink", () => {
    expect(sheet).toMatch(/^\s*--ring:\s*var\(--primary-ink\);/m);
  });

  it("leaves both polarity classes to the palettes (EV binds neither)", () => {
    const palettes = rules.filter((r) => r.declarations.has("background"));
    expect(palettes.map((r) => r.selector)).toEqual([':where(:root, [data-brand="ev"])']);
  });

  it("scales the geometry up on a brand scope as it does on the root", () => {
    const bumps = rules.filter((r) => r.declarations.has("page-px") && r.declarations.get("page-px") !== "1rem");
    expect(bumps.length).toBeGreaterThan(0);
    for (const bump of bumps) expect(bump.selector).toBe(":where(:root, [data-brand])");
  });
});
