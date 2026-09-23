import { expect, test, type Page } from "@playwright/test";

/**
 * `@evinvest/kitstart/testing/e2e` — the section-baseline runner a brand's
 * Playwright suite calls. One baseline per section at both designed
 * breakpoints; every section reached by its own URL (a `#` the site itself
 * links to), never by scrolling to it — a scroll is a moving target the runner
 * would have to guess is over. `@playwright/test` is an optional peer.
 */

/**
 * Waits until a section is what a visitor sees: web fonts applied, every
 * image in it loaded (lazy ones forced), the network idle, and every finite
 * animation finished — `animations: "disabled"` freezes CSS animations, not
 * ones driven through the Web Animations API.
 */
export async function settle(page: Page, selector: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.locator(selector).evaluate(root =>
    Promise.all(
      Array.from(root.querySelectorAll("img"), img => {
        img.loading = "eager";
        if (img.complete) return null;
        return new Promise(done => {
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        });
      }),
    ),
  );
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .filter(a => (a.effect?.getComputedTiming().iterations ?? 1) !== Infinity)
        .every(a => a.playState === "finished" || a.playState === "idle"),
    undefined,
    { timeout: 10_000 },
  );
}

export interface Section {
  name: string;
  /** Relative to the config's `baseURL`, or absolute for another host. */
  url: string;
  selector: string;
  /** `md:hidden` in the design: shot only in the `mobile` project. */
  mobileOnly?: boolean;
  /** Shot without the section stylesheet (the call bar hides itself in it). */
  bare?: boolean;
}

/** The two designed breakpoints, as Playwright projects. */
export const BREAKPOINTS = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
] as const;

/** One `test` per section, each a `toHaveScreenshot` of the settled section. */
export function defineSectionSuite(sections: readonly Section[]): void {
  // The site scrolls smoothly for everyone who has not asked it not to;
  // `use.reducedMotion` does not reach the page, `emulateMedia` does.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  for (const section of sections) {
    test(`section: ${section.name}`, async ({ page }, info) => {
      test.skip(Boolean(section.mobileOnly) && info.project.name !== "mobile");
      await page.goto(section.url);
      const locator = page.locator(section.selector);
      await expect(locator).toBeVisible();
      await settle(page, section.selector);
      await expect(locator).toHaveScreenshot(`${section.name}-${info.project.name}.png`, section.bare ? { stylePath: [] } : {});
    });
  }
}
