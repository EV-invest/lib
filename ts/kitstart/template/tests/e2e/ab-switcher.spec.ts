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
const cookieNames = async (context: BrowserContext) => (await context.cookies()).map(c => c.name);

/** A test visit assigned `b`, as the brand's proxy would have left it, on a page that forces it. */
async function assignedB(page: Page, context: BrowserContext, baseURL: string | undefined) {
  await asTester(context, baseURL);
  await context.addCookies([{ name: "ab_lead_form", value: "b", url: baseURL ?? "" }]);
  await page.goto("/fr?ab_lead_form=b&utm_x=1");
  await chip(page).click();
  await expect(panel(page)).toBeVisible();
}

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

test("Reset drops the assignment and its force, keeps the other parameters and the QA cookie, and the chip", async ({ page, context, baseURL }) => {
  await assignedB(page, context, baseURL);
  await expect(panel(page).getByRole("button", { name: "Steps" })).toHaveAttribute("aria-pressed", "true");
  await panel(page).getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page).toHaveURL(/\/fr\?utm_x=1$/);
  const names = await cookieNames(context);
  expect(names).not.toContain("ab_lead_form");
  expect(names).toContain(QA_COOKIE);
  await expect(chip(page)).toBeVisible();
});

test("Leave test drops the QA cookie too: after the load there is no chip", async ({ page, context, baseURL }) => {
  await assignedB(page, context, baseURL);
  await panel(page).getByRole("button", { name: "Leave test" }).click();
  await expect(page).toHaveURL(/\/fr\?utm_x=1$/);
  await hydrated(page);
  // Settled: the gate decided on hydration, and a panel it fetched would be in.
  await page.waitForLoadState("networkidle");
  expect(await cookieNames(context)).not.toContain(QA_COOKIE);
  expect(await cookieNames(context)).not.toContain("ab_lead_form");
  await expect(chip(page)).toHaveCount(0);
});

test("Escape closes the panel and gives the focus back to the chip", async ({ page, context, baseURL }) => {
  await assignedB(page, context, baseURL);
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(chip(page)).toBeFocused();
});

test("Hide removes the chip until the next load", async ({ page, context, baseURL }) => {
  await assignedB(page, context, baseURL);
  await panel(page).getByRole("button", { name: "Hide" }).click();
  await expect(chip(page)).toHaveCount(0);
  await page.reload();
  await expect(chip(page)).toBeVisible();
});
