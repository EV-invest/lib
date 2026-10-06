import { expect, test, type BrowserContext, type Page, type Response } from "@playwright/test";
import { QA_COOKIE } from "../../src/shared/config/experiments";

// The QA menu (`AbSwitcher`): a visit with the QA cookie gets the chip and
// its panel, loaded on demand; a visitor without it gets neither — the
// panel's chunk is never even requested. A tap on a variant is the brand's
// own force parameter; the reset drops it and keeps the visit a test.

const hydrated = (page: Page) => expect(page.locator("#quote select")).toHaveCount(0);
const chip = (page: Page) => page.getByRole("button", { name: "A/B test switcher" });
const panel = (page: Page) => page.getByRole("dialog", { name: "A/B test switcher" });
const scripts = (page: Page) => {
  const seen: Response[] = [];
  page.on("response", r => void (new URL(r.url()).pathname.endsWith(".js") && seen.push(r)));
  return seen;
};
const asTester = (context: BrowserContext, baseURL: string | undefined) => context.addCookies([{ name: QA_COOKIE, value: "1", url: baseURL ?? "" }]);

test("a new visitor gets no menu and never fetches its panel; a test visit gets both", async ({ page, context, baseURL }) => {
  const visitor = scripts(page);
  await page.goto("/fr");
  await hydrated(page);
  // Settled: the gate's effect ran on hydration, and anything it fetched is in.
  await page.waitForLoadState("networkidle");
  await expect(chip(page)).toHaveCount(0);
  const fetched = visitor.map(r => r.url());

  await asTester(context, baseURL);
  const tester = scripts(page);
  await page.goto("/fr");
  await chip(page).click();
  await expect(panel(page)).toBeVisible();
  const marked = await Promise.all(tester.map(async r => ((await r.text()).includes("data-ab-switcher") ? r.url() : null)));
  const chunks = marked.filter(u => u !== null);
  expect(chunks.length).toBeGreaterThan(0);
  for (const url of chunks) expect(fetched).not.toContain(url);
});

test("a variant's tap forces it by the URL; the reset drops the force and keeps the visit a test", async ({ page, context, baseURL }) => {
  await asTester(context, baseURL);
  await page.goto("/fr?utm_source=qa");
  await chip(page).click();
  await panel(page).getByRole("button", { name: "Steps" }).click();
  await expect(page).toHaveURL(/\/fr\?utm_source=qa&ab_lead_form=b$/);

  await chip(page).click();
  await panel(page).getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page).toHaveURL(/\/fr\?utm_source=qa$/);
  expect((await context.cookies()).map(c => c.name)).toContain(QA_COOKIE);
  await expect(chip(page)).toBeVisible();
});
