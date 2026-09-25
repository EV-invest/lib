import { expect, test, type Locator, type Page } from "@playwright/test";

// The quote form's contract with the visitor: it posts before any script
// (the one standing in water may be on a bad connection), and once the script
// is there the choice is the kit's list, not the platform's menu — in the
// same box, so nothing moves when one becomes the other.
const SUBJECT = "Prestation";

async function fillAndSend(page: Page) {
  await page.getByLabel("Ville ou code postal").fill("75011");
  await page.getByLabel("Mobile").fill("0612345678");
  await page.getByRole("button", { name: "Recevoir le prix" }).click();
}

test.describe("without JavaScript", () => {
  // Reduced motion drops the page's smooth scroll, which without a script
  // Playwright never sees settle before it clicks.
  test.use({ javaScriptEnabled: false, reducedMotion: "reduce" });

  test("the form posts the native select's value", async ({ page }) => {
    await page.goto("/fr#quote");
    const select = page.locator("#quote select[name=subject]");
    await expect(select).toBeVisible();
    await expect(page.getByLabel(SUBJECT)).toHaveJSProperty("tagName", "SELECT");
    await select.selectOption("deep");
    const posted = page.waitForRequest(r => r.method() === "POST" && new URL(r.url()).pathname === "/quote");
    await fillAndSend(page);
    expect(new URLSearchParams((await posted).postData() ?? "").get("subject")).toBe("deep");
    await expect(page).toHaveURL(/\/fr\/thanks$/);
  });
});

test.describe("with JavaScript", () => {
  test("the choice is the kit's list, and the form posts it", async ({ page }) => {
    await page.goto("/fr#quote");
    const trigger = page.getByRole("combobox", { name: SUBJECT });
    await expect(trigger).toBeVisible();
    await expect(page.locator("#quote select")).toHaveCount(0);
    await trigger.click();
    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();
    await list.getByRole("option", { name: "Grand ménage" }).click();
    await expect(list).toBeHidden();
    await expect(trigger).toHaveText("Grand ménage");
    const posted = page.waitForRequest(r => r.method() === "POST" && new URL(r.url()).pathname === "/quote");
    await fillAndSend(page);
    expect(new URLSearchParams((await posted).postData() ?? "").get("subject")).toBe("deep");
    await expect(page).toHaveURL(/\/fr\/thanks$/);
  });

  test("works from the keyboard", async ({ page }) => {
    await page.goto("/fr#quote");
    const trigger = page.getByRole("combobox", { name: SUBJECT });
    // Before hydration the role finds the server's select, and the focus
    // would go to it, not the kit's list; wait for the select to be replaced.
    await expect(page.locator("#quote select")).toHaveCount(0);
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("option", { name: "Ménage courant" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("listbox")).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveText("Grand ménage");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Ville ou code postal")).toBeFocused();
  });
});

test("the field is the same box before and after hydration", async ({ browser }) => {
  const open = async (javaScriptEnabled: boolean) => {
    const context = await browser.newContext({ javaScriptEnabled });
    const page = await context.newPage();
    await page.goto("/fr#quote");
    return page;
  };
  const measure = (control: Locator) =>
    control.evaluate(el => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height, x: r.x, border: getComputedStyle(el).borderTopWidth, radius: getComputedStyle(el).borderTopLeftRadius };
    });

  // The server's select is a combobox of the same name, so until the page
  // hydrates the role finds it — and hydration detaches it, leaving a
  // measurement of zeros. Measure only once the kit's button has replaced it.
  const scripted = await open(true);
  await expect(scripted.locator("#quote select")).toHaveCount(0);
  const kit = scripted.getByRole("combobox", { name: SUBJECT });
  await expect(kit).toHaveJSProperty("tagName", "BUTTON");
  await expect(kit).toBeVisible();
  const hydrated = await measure(kit);
  await scripted.context().close();

  const bare = await open(false);
  const native = bare.locator("#quote select[name=subject]");
  await expect(native).toBeVisible();
  const server = await measure(native);
  await bare.context().close();

  expect(hydrated).toEqual(server);
});
