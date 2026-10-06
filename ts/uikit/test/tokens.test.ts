import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import { buttonVariants } from "../src/components/button";
import { CHECKBOX_BASE } from "../src/generated/checkbox";
import { CONTEXT_MENU_CHECK_ITEM, CONTEXT_MENU_ITEM, CONTEXT_MENU_SUB_TRIGGER } from "../src/generated/context-menu";
import { DROPDOWN_MENU_CHECK_ITEM, DROPDOWN_MENU_ITEM, DROPDOWN_MENU_SUB_TRIGGER } from "../src/generated/dropdown-menu";
import { OPTION_FOCUS_RING } from "../src/generated/focus";
import { INPUT_BASE } from "../src/generated/input";
import { INPUT_GROUP_BASE } from "../src/generated/input-group";
import { INPUT_OTP_SLOT } from "../src/generated/input-otp";
import {
  MENUBAR_CHECKBOX_ITEM,
  MENUBAR_ITEM,
  MENUBAR_RADIO_ITEM,
  MENUBAR_SUB_TRIGGER,
  MENUBAR_TRIGGER,
} from "../src/generated/menubar";
import { PROGRESS_INDICATOR, PROGRESS_TRACK } from "../src/generated/progress";
import { SLIDER_RANGE, SLIDER_TRACK } from "../src/generated/slider";
import { SWITCH_BASE, SWITCH_THUMB } from "../src/generated/switch";
import { TEXTAREA_BASE } from "../src/generated/textarea";
import { RADIO_GROUP_ITEM } from "../src/generated/radio-group";
import { SELECT_ITEM } from "../src/generated/select";
import { TOGGLE_BASE, toggleVariantClasses } from "../src/generated/toggle";
import { brandFromToml, DERIVED_SCOPE, readContract, readRules, renderPalette, type CssRule } from "../src/palette";

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

const derivedRule = readRules(sheet).find((r) => r.selector === DERIVED_SCOPE);

/**
 * `--ring` as painted in `scope`: the palette's own value when it pins one,
 * else the contract's formula resolved against the palette (`var(--primary-ink)`
 * today) — so a retune of either side is what gets measured.
 */
function ring(scope: Scope): string {
  if (scope.rule.declarations.has("ring")) return token("ring", scope);
  const formula = derivedRule?.declarations.get("ring");
  const ref = formula && /^var\(--([a-z0-9-]+)\)$/.exec(formula);
  if (!ref?.[1]) throw new Error(`the contract's --ring is not a plain reference: ${formula}`);
  return token(ref[1], scope);
}

/**
 * A derived line token (`--input`, `--border`) as painted over `surface` in
 * `scope`: the palette's own hex when it pins one, else the contract's
 * `color-mix(in srgb, var(--ink) N%, transparent)` composited onto the surface
 * — the translucent line is only ever seen over whatever is under it.
 */
function line(name: string, scope: Scope, surface: string): string {
  if (scope.rule.declarations.has(name)) return token(name, scope);
  const formula = derivedRule?.declarations.get(name);
  const mix = formula && /^color-mix\(in srgb, var\(--([a-z0-9-]+)\) (\d+(?:\.\d+)?)%, transparent\)$/.exec(formula);
  if (!mix?.[1] || !mix[2]) throw new Error(`the contract's --${name} is not an ink mix: ${formula}`);
  return composite(token(mix[1], scope), Number(mix[2]) / 100, surface);
}

/**
 * A derived ink (`--accent-error-ink`) as painted in `scope`: the palette's own
 * hex when it pins one, else the contract's
 * `color-mix(in srgb, var(--a) N%, var(--b))` resolved against the palette —
 * two opaque colours, so the mix is the same sRGB blend as `composite`.
 */
function derivedInk(name: string, scope: Scope): string {
  if (scope.rule.declarations.has(name)) return token(name, scope);
  const formula = derivedRule?.declarations.get(name);
  const mix =
    formula && /^color-mix\(in srgb, var\(--([a-z0-9-]+)\) (\d+(?:\.\d+)?)%, var\(--([a-z0-9-]+)\)\)$/.exec(formula);
  if (!mix?.[1] || !mix[2] || !mix[3]) throw new Error(`the contract's --${name} is not a mix of two tokens: ${formula}`);
  return composite(token(mix[1], scope), Number(mix[2]) / 100, token(mix[3], scope));
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

  // lib#129. A filled control's focus indicator is the solid ring 2px off the
  // control, so both of its edges are against the surface: ring | surface gap |
  // fill. The fill-vs-surface edge is the "fill reads as a shape" floor above;
  // this is the other one. The 50 % halo it replaced measured ~2:1 here.
  describe("focus ring on a filled control", () => {
    it.each(["background", "secondary", "card", "popover"])("the ring reads against %s (non-text 3:1)", (surface) => {
      expect(contrast(ring(scope), t(surface))).toBeGreaterThanOrEqual(3);
    });

    it("stands off the fill, so the ring is never measured against it", () => {
      for (const classes of [
        buttonVariants({ variant: "primary" }),
        buttonVariants({ variant: "destructive" }),
        buttonVariants({ variant: "ghost", accent: "warn" }),
      ]) {
        expect(classes).toMatch(/\bfocus-visible:outline-offset-2\b/);
        expect(classes).toMatch(/\bfocus-visible:outline-ring\b/);
        expect(classes).not.toMatch(/focus-visible:ring-\[3px\]/);
      }
    });
  });

  // lib#154. `--input` is the visible boundary of a control that has no fill
  // (outline button, input, select, checkbox, radio), so it owes the non-text
  // 3:1 on every surface a control sits on. `--border` stays a divider: it is
  // decoration, and at 3:1 every card edge would shout.
  describe("control boundary", () => {
    it.each(["background", "secondary", "card", "popover"])("--input reads against %s (non-text 3:1)", (surface) => {
      expect(contrast(line("input", scope, t(surface)), t(surface))).toBeGreaterThanOrEqual(3);
    });

    it("the unchecked switch thumb still reads on its --input track", () => {
      expect(SWITCH_BASE).toMatch(/\bdata-\[state=unchecked\]:bg-input\b/);
      expect(SWITCH_THUMB).toMatch(/\bdata-\[state=unchecked\]:bg-ink\b/);
      for (const surface of ["background", "card"]) {
        expect(contrast(t("ink"), line("input", scope, t(surface)))).toBeGreaterThanOrEqual(3);
      }
    });
  });

  // An open list's focused row: the `bg-hover` tint alone is a surface step
  // (1.22:1 on EV's popover, 1.14:1 and 1.00:1 where a brand pins --hover), so
  // the indicator is the inset --ring, which sits between the tint inside the
  // row and the popover around it and owes 3:1 to both.
  describe("focused option in an open list", () => {
    const tint = () => line("hover", scope, t("popover"));

    it("the ring reads against the popover and against the tint (non-text 3:1)", () => {
      expect(contrast(ring(scope), t("popover"))).toBeGreaterThanOrEqual(3);
      expect(contrast(ring(scope), tint())).toBeGreaterThanOrEqual(3);
    });

    it("the label reads on the tint (AA text)", () => {
      expect(contrast(t("ink"), tint())).toBeGreaterThanOrEqual(4.5);
    });

    // A destructive menu row swaps the tint for 10 % of --accent-error, so the
    // ring's inner edge sits on that instead.
    it("the ring reads against a destructive row's tint (non-text 3:1)", () => {
      for (const classes of [DROPDOWN_MENU_ITEM, CONTEXT_MENU_ITEM, MENUBAR_ITEM]) {
        expect(classes).toMatch(/(^|\s)data-\[variant=destructive\]:focus:bg-accent-error\/10(\s|$)/);
      }
      const destructive = composite(t("accent-error"), 0.1, t("popover"));
      expect(contrast(ring(scope), destructive)).toBeGreaterThanOrEqual(3);
    });
  });

  // lib#166. A destructive row is text on 10 % of the error role, so it reads
  // in the role's ink: the fill itself measured 3.76:1 there on EV and 2.48:1
  // on the demo's dark side. The row sits on the popover unfocused, so it owes
  // AA there too.
  describe("destructive menu row", () => {
    const ink = () => derivedInk("accent-error-ink", scope);

    it("the text reads on the row's tint (AA text)", () => {
      expect(contrast(ink(), composite(t("accent-error"), 0.1, t("popover")))).toBeGreaterThanOrEqual(4.5);
    });

    it("the text reads on the popover at rest (AA text)", () => {
      expect(contrast(ink(), t("popover"))).toBeGreaterThanOrEqual(4.5);
    });
  });

  // lib#175. "On" is the primary fill and "off" leaves the surface showing, so
  // the state is told apart by the fill against each plane a toggle sits on.
  // Hover paints a surface tint (bg-muted, or bg-hover on outline), never the
  // fill, so a pointed-at item cannot pass for a selected one.
  describe("toggle on vs off", () => {
    it.each(["background", "secondary", "card", "popover"])("on reads against off on %s (non-text 3:1)", (surface) => {
      expect(TOGGLE_BASE).toMatch(/(^|\s)data-\[state=on\]:bg-primary(\s|$)/);
      expect(contrast(t("primary"), t(surface))).toBeGreaterThanOrEqual(3);
    });

    it("the on label reads on the fill (AA text)", () => {
      expect(TOGGLE_BASE).toMatch(/(^|\s)data-\[state=on\]:text-on-primary(\s|$)/);
      expect(contrast(t("on-primary"), t("primary"))).toBeGreaterThanOrEqual(4.5);
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

// The floor above is only worth something if the controls draw their frame with
// the token it measures, not with the divider.
describe("outlined controls frame with --input", () => {
  it.each([
    ["button outline", buttonVariants({ variant: "outline" })],
    ["toggle outline", toggleVariantClasses.outline],
    ["input", INPUT_BASE],
    ["textarea", TEXTAREA_BASE],
    ["checkbox", CHECKBOX_BASE],
    ["radio", RADIO_GROUP_ITEM],
    ["input group", INPUT_GROUP_BASE],
    ["otp slot", INPUT_OTP_SLOT],
  ])("%s", (_, classes) => {
    expect(classes).toMatch(/(^|\s)border-input(\s|$)/);
    expect(classes).not.toMatch(/(^|\s)border-border(\s|$)/);
  });
});

// The destructive-row floor measures --accent-error-ink, so the rows have to
// paint their text and icon with it rather than with the fill.
describe("destructive menu rows read in the error ink", () => {
  it.each([
    ["dropdown menu item", DROPDOWN_MENU_ITEM],
    ["context menu item", CONTEXT_MENU_ITEM],
    ["menubar item", MENUBAR_ITEM],
  ])("%s", (_, classes) => {
    expect(classes).toMatch(/(^|\s)data-\[variant=destructive\]:text-accent-error-ink(\s|$)/);
    expect(classes).toMatch(/(^|\s)data-\[variant=destructive\]:focus:text-accent-error-ink(\s|$)/);
    expect(classes).toMatch(/(^|\s)data-\[variant=destructive\]:\*:\[svg\]:!text-accent-error-ink(\s|$)/);
    expect(classes).not.toMatch(/text-accent-error(\s|$)/);
  });
});

// The on-vs-off floor holds only while hover stays a surface tint.
describe("toggle hover is not the on state", () => {
  it.each([
    ["bare", `${TOGGLE_BASE} ${toggleVariantClasses.bare}`],
    ["outline", `${TOGGLE_BASE} ${toggleVariantClasses.outline}`],
  ])("%s", (_, classes) => {
    const hover = classes.split(/\s+/).filter((c) => c.startsWith("hover:bg-"));
    expect(hover.length).toBeGreaterThan(0);
    expect(hover).not.toContain("hover:bg-primary");
    expect(classes).not.toMatch(/(^|\s)data-\[state=on\]:bg-hover(\s|$)/);
  });

  it("an outline toggle's frame follows its fill when on", () => {
    expect(toggleVariantClasses.outline).toMatch(/(^|\s)data-\[state=on\]:border-primary(\s|$)/);
  });
});

// The floor above is only worth something if the rows draw their focus with
// the ring it measures, not with the tint alone.
describe("list rows ring their keyboard focus", () => {
  it("is the inset --ring, on focus-visible", () => {
    expect(OPTION_FOCUS_RING).toMatch(/\bfocus-visible:inset-ring-2\b/);
    expect(OPTION_FOCUS_RING).toMatch(/\bfocus-visible:inset-ring-ring\b/);
  });

  it.each([
    ["select item", SELECT_ITEM],
    ["dropdown menu item", DROPDOWN_MENU_ITEM],
    ["dropdown menu check item", DROPDOWN_MENU_CHECK_ITEM],
    ["dropdown menu sub trigger", DROPDOWN_MENU_SUB_TRIGGER],
    ["context menu item", CONTEXT_MENU_ITEM],
    ["context menu check item", CONTEXT_MENU_CHECK_ITEM],
    ["context menu sub trigger", CONTEXT_MENU_SUB_TRIGGER],
    ["menubar trigger", MENUBAR_TRIGGER],
    ["menubar item", MENUBAR_ITEM],
    ["menubar checkbox item", MENUBAR_CHECKBOX_ITEM],
    ["menubar radio item", MENUBAR_RADIO_ITEM],
    ["menubar sub trigger", MENUBAR_SUB_TRIGGER],
  ])("%s", (_, classes) => {
    expect(classes).toContain(OPTION_FOCUS_RING);
  });
});

describe("the contract half of the sheet", () => {
  const rules = readRules(sheet);

  it("derives the lines, hover and secondary ink rather than asking a palette for them", () => {
    expect([...contract.derived].sort()).toEqual(["accent-error-ink", "border", "hover", "ink-mid", "ink-soft", "input", "ring"]);
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
