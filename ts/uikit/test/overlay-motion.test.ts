import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ALERT_DIALOG_CONTENT, ALERT_DIALOG_OVERLAY } from "../src/generated/alert-dialog";
import { DIALOG_CLOSE, DIALOG_CONTENT, DIALOG_OVERLAY } from "../src/generated/dialog";
import { DRAWER_OVERLAY } from "../src/generated/drawer";
import { SHEET_CLOSE, SHEET_CONTENT, SHEET_OVERLAY } from "../src/generated/sheet";

// The shipped, flattened sheet — run from ts/uikit, as tokens.test.ts.
const sheet = readFileSync(join(process.cwd(), "styles/tokens.css"), "utf8");

const tokens = (classes: string) => classes.split(/\s+/);

/** The animation clock a class list sets for one `data-state` (a bare `duration-*` covers both). */
function duration(classes: string, state: "open" | "closed"): string | undefined {
  const list = tokens(classes);
  const scoped = list.find((c) => c.startsWith(`data-[state=${state}]:duration-`));
  return (scoped ?? list.find((c) => c.startsWith("duration-")))?.split("duration-")[1];
}

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

const pairs = [
  ["sheet", SHEET_OVERLAY, SHEET_CONTENT],
  ["dialog", DIALOG_OVERLAY, DIALOG_CONTENT],
  ["alert-dialog", ALERT_DIALOG_OVERLAY, ALERT_DIALOG_CONTENT],
] as const;

describe("overlay scrims run on their panel's clock", () => {
  it.each(pairs)("%s: the scrim enters and leaves with the panel", (_, overlay, content) => {
    for (const state of ["open", "closed"] as const) {
      expect(duration(overlay, state), state).toBeDefined();
      expect(duration(overlay, state), state).toBe(duration(content, state));
    }
  });

  it("sheet keeps its 500ms in / 300ms out", () => {
    expect(duration(SHEET_OVERLAY, "open")).toBe("500");
    expect(duration(SHEET_OVERLAY, "closed")).toBe("300");
  });

  it.each(pairs)("%s: scrim and panel hold their last exit frame", (_, overlay, content) => {
    expect(tokens(overlay)).toContain("data-[state=closed]:fill-mode-forwards");
    expect(tokens(content)).toContain("data-[state=closed]:fill-mode-forwards");
  });

  it.each([...pairs.map(([n, o]) => [n, o] as const), ["drawer", DRAWER_OVERLAY] as const])(
    "%s: a closing scrim lets the next click through to the page",
    (_, overlay) => {
      expect(tokens(overlay)).toContain("data-[state=closed]:pointer-events-none");
    },
  );

  it.each(pairs)("%s: the panel draws no outline when it holds focus itself", (_, __, content) => {
    expect(tokens(content)).toContain("outline-hidden");
  });
});

describe("close buttons ring on keyboard focus only", () => {
  it.each([
    ["sheet", SHEET_CLOSE],
    ["dialog", DIALOG_CLOSE],
  ])("%s", (_, close) => {
    expect(tokens(close).filter((c) => c.startsWith("focus:"))).toEqual([]);
    expect(tokens(close)).toEqual(
      expect.arrayContaining(["focus-visible:ring-2", "focus-visible:ring-offset-2", "focus-visible:ring-ring"]),
    );
  });
});

describe("reduced motion: sheet and dialogs fade instead of travelling", () => {
  const reduced = reducedMotionBlocks(sheet);

  it("covers all three panels", () => {
    for (const slot of ["sheet-content", "dialog-content", "alert-dialog-content"]) {
      expect(reduced).toContain(`[data-slot="${slot}"]`);
    }
  });

  it("zeroes the travel and the scale and keeps a fade", () => {
    const rule = reduced.slice(reduced.indexOf('[data-slot="sheet-content"]'));
    const body = rule.slice(rule.indexOf("{") + 1, rule.indexOf("}"));
    for (const [prop, value] of [
      ["--tw-enter-translate-x", "0"],
      ["--tw-enter-translate-y", "0"],
      ["--tw-exit-translate-x", "0"],
      ["--tw-exit-translate-y", "0"],
      ["--tw-enter-scale", "1"],
      ["--tw-exit-scale", "1"],
      ["--tw-enter-opacity", "0"],
      ["--tw-exit-opacity", "0"],
    ] as const) {
      expect(body, prop).toMatch(new RegExp(`${prop}:\\s*${value};`));
    }
  });

  it("leaves the animation itself running, so the exit still unmounts on animationend", () => {
    const rule = reduced.slice(reduced.indexOf('[data-slot="sheet-content"]'));
    const body = rule.slice(rule.indexOf("{") + 1, rule.indexOf("}"));
    expect(body).not.toMatch(/animation\s*:/);
    expect(body).not.toContain("!important");
  });
});
