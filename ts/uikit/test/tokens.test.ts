import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// The shipped sheet, not the repo-root source: a consumer imports this one.
// Resolved from cwd rather than import.meta.url: jsdom rewrites the module URL
// to http://, which `new URL(...)` then refuses to read from disk.
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

// The floors docs/spec/accents.md commits to for a role whose fill and ink
// diverge. Measured, because a retune of one value quietly moves the other.
describe("primary fill vs ink", () => {
  const surfaces = ["background", "secondary", "card"] as const;

  it("the label reads on the fill (AA text)", () => {
    expect(contrast(token("primary"), token("on-primary"))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(surfaces)("the fill reads as a shape on %s (non-text 3:1)", (surface) => {
    expect(contrast(token("primary"), token(surface))).toBeGreaterThanOrEqual(3);
  });

  it.each(["background", "card"] as const)("the ink reads as text on %s (AA text)", (surface) => {
    expect(contrast(token("primary-ink"), token(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it("the focus ring is the ink", () => {
    expect(sheet).toMatch(/^\s*--ring:\s*var\(--primary-ink\);/m);
  });
});
