import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// Capture (and one colour check at the end) — the comparison is a byte-exact `diff` in `nix run
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

// The two states of `FormSelect` must draw alike, not only measure alike: the
// placeholder and a chosen value in the native select's colours, in a real
// browser over the compiled Tailwind — where a variant that misses its element
// (as the kit's trigger's placeholder rule once did) shows.
test("form-select: the scripted field draws its text as the native one does", async ({ page }) => {
  await page.goto("/form-select.html");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  const color = (selector: string) => page.locator(selector).evaluate(el => getComputedStyle(el).color);
  const placeholder = await color("#home-native");
  expect(await color("#home-scripted [data-placeholder]")).toBe(placeholder);
  expect(await color("#job-scripted [data-slot=select-value]")).toBe(await color("#job-native"));
  // Not merely inherited: the trigger itself is in ink, its placeholder is not.
  expect(await color("#home-scripted")).not.toBe(placeholder);
});
