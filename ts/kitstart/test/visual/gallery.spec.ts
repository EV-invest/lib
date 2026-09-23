import { test } from "@playwright/test";
import { readFileSync } from "node:fs";

// Capture only — the comparison is a byte-exact `diff` in `nix run
// .#kitstart-visual`, as in the kit's own suite: once runner, browser, fonts
// and the Tailwind engine are pinned, a diff-ratio threshold only hides drift.
// The page list comes from `dist/manifest.json`, which the gallery test writes.
const OUT = process.env["KITSTART_SNAPSHOT_OUT"];
if (!OUT) throw new Error("KITSTART_SNAPSHOT_OUT unset — this runs through `nix run .#kitstart-visual`");

const PAGES: { name: string; widths: "mobile" | "both" }[] = JSON.parse(readFileSync(new URL("./dist/manifest.json", import.meta.url), "utf8"));
const WIDTHS = { mobile: [390], both: [390, 1280] } as const;

for (const { name, widths } of PAGES) {
  for (const width of WIDTHS[widths]) {
    test(`${name}-${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${name}.html`);
      // Tailwind compiles in the browser after load; networkidle fires once its
      // script stopped fetching, and the buffer covers the compile and paint.
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800);
      await page.locator("#stage").screenshot({ path: `${OUT}/${name}-${width}.png`, animations: "disabled" });
    });
  }
}
