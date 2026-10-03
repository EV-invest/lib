import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The shipped, flattened sheet: what a consumer actually imports. Same caveat as
// tokens.test.ts — run from ts/uikit.
const sheet = readFileSync(join(process.cwd(), "styles/tokens.css"), "utf8");

function reducedMotionBlocks(css: string): string {
  const out: string[] = [];
  const re = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
    }
    out.push(css.slice(re.lastIndex, i));
  }
  return out.join("\n");
}

describe("shell motion contract", () => {
  it("ships the motion tokens on every theme root", () => {
    for (const token of [
      "--ev-ease-out",
      "--ev-ease-in-out",
      "--ev-dur-fast",
      "--ev-dur-base",
      "--ev-dur-slow",
      "--ev-rise",
      "--ev-stagger",
      "--ev-stagger-section",
      "--shell-rail-w",
      "--shell-tab-bar-h",
    ]) {
      expect(sheet, token).toMatch(new RegExp(`${token}:\\s*[^;]+;`));
    }
  });

  it("animates the shell from the data-attribute contract", () => {
    for (const selector of [
      '[data-enter="rise"]',
      '[data-enter="stagger"] > *',
      '[data-slot="settled"][data-state="revealed"]',
      '[data-slot="shell-nav-marker"]',
      '[data-slot="shell-nav-marker"]:not([data-placed])',
      '[data-slot="tab-bar-marker"][data-state="idle"]',
      '[data-slot="skeleton"].animate-pulse',
    ]) {
      expect(sheet, selector).toContain(selector);
    }
  });

  it("calms every shell animation under prefers-reduced-motion", () => {
    const reduced = reducedMotionBlocks(sheet);
    expect(reduced).toContain('[data-enter="rise"]');
    expect(reduced).toContain('[data-enter="stagger"] > *');
    expect(reduced).toContain('[data-slot="settled"][data-state="revealed"]');
    expect(reduced).toMatch(/animation-name:\s*ev-enter-fade/);
    expect(reduced).toContain('[data-slot="shell-nav-marker"]');
    expect(reduced).toContain('[data-slot="tab-bar-marker"]');
    expect(reduced).toContain('[data-slot="skeleton"].animate-pulse');
  });

  it("keeps the marked row filled until the marker is placed", () => {
    expect(sheet).toMatch(
      /\[data-slot="shell-nav-marker"\]:not\(\[data-placed\]\) ~ \* \[aria-current="page"\]\s*\{\s*background-color:\s*var\(--primary\)/,
    );
  });
});
