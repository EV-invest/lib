import { expect, test, type Page } from "@playwright/test";

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
  const box = async (javaScriptEnabled: boolean) => {
    const context = await browser.newContext({ javaScriptEnabled });
    const page = await context.newPage();
    await page.goto("/fr#quote");
    const control = javaScriptEnabled ? page.getByRole("combobox", { name: SUBJECT }) : page.locator("#quote select[name=subject]");
    await expect(control).toBeVisible();
    const rect = await control.evaluate(el => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height, x: r.x, border: getComputedStyle(el).borderTopWidth, radius: getComputedStyle(el).borderTopLeftRadius };
    });
    await context.close();
    return rect;
  };
  expect(await box(true)).toEqual(await box(false));
});
