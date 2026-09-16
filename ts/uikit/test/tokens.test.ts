import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import { PROGRESS_INDICATOR, PROGRESS_TRACK } from "../src/generated/progress";
import { SLIDER_RANGE, SLIDER_TRACK } from "../src/generated/slider";

// The shipped sheet, not the repo-root source: a consumer imports this one.
// Resolved from cwd rather than import.meta.url: jsdom rewrites the module URL
// to http://, which `new URL(...)` then refuses to read from disk. The cwd is
// `ts/uikit` — vitest runs from the package root (`npm test`), which is where
// `styles/tokens.css` resolves; run it from anywhere else and the read fails
// loudly rather than measuring the wrong sheet.
const sheet = readFileSync(join(process.cwd(), "styles/tokens.css"), "utf8");

function token(name: string): string {
  const match = sheet.match(new RegExp(`^\\s*--${name}:\\s*(#[0-9a-f]{6});`, "m"));
  if (!match?.[1]) throw new Error(`--${name} is not a plain hex token`);
  return match[1];
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

// The floors docs/spec/accents.md commits to for a role whose fill and ink
// diverge. Measured, because a retune of one value quietly moves the other.
describe("primary fill vs ink", () => {
  const surfaces = ["background", "secondary", "card", "popover"] as const;

  it("the label reads on the fill (AA text)", () => {
    expect(contrast(token("primary"), token("on-primary"))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(surfaces)("the fill reads as a shape on %s (non-text 3:1)", (surface) => {
    expect(contrast(token("primary"), token(surface))).toBeGreaterThanOrEqual(3);
  });

  // The documented exception, pinned so it stays one: a fill on muted is
  // identified by its on-primary mark, never as a bare shape. Should a retune
  // ever clear 3:1 here, the spec's list of surfaces is what should change.
  it("the fill is under the floor on muted (the spec's stated exception)", () => {
    expect(contrast(token("primary"), token("muted"))).toBeLessThan(3);
  });

  it.each(["background", "card"] as const)("the ink reads as text on %s (AA text)", (surface) => {
    expect(contrast(token("primary-ink"), token(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it("the focus ring is the ink", () => {
    expect(sheet).toMatch(/^\s*--ring:\s*var\(--primary-ink\);/m);
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
    expect(contrast(token("primary-ink"), token("muted"))).toBeGreaterThanOrEqual(3);
    expect(contrast(token("muted"), token("card"))).toBeGreaterThanOrEqual(1.3);
  });

  it("the progress indicator is the ink on a 20% tint of itself, composited on card", () => {
    expect(PROGRESS_INDICATOR).toMatch(/\bbg-primary-ink\b/);
    expect(PROGRESS_TRACK).toMatch(/\bbg-primary-ink\/20\b/);
    const track = composite(token("primary-ink"), 0.2, token("card"));
    expect(contrast(token("primary-ink"), track)).toBeGreaterThanOrEqual(3);
    expect(contrast(track, token("card"))).toBeGreaterThanOrEqual(1.3);
  });
});
