import { expect, test, type Locator, type Page } from "@playwright/test";

// The quote form's contract with the visitor: it posts before any script
// (the one standing in water may be on a bad connection), and once the script
// is there the choice is the kit's list, not the platform's menu — in the
// same box, so nothing moves when one becomes the other.
const SUBJECT = "Prestation";

async function fillAndSend(page: Page) {
  const form = page.locator("#quote");
  await form.getByLabel("Code postal").fill("75011");
  await form.getByLabel("Téléphone").fill("0612345678");
  await form.getByRole("button", { name: "Recevoir le prix" }).click();
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
    await expect(page.locator("#quote").getByLabel("Code postal")).toBeFocused();
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

// `LeadCapture`'s other ways in. The template's place has no number and keeps
// office hours, which is the case these hold: no call, text or WhatsApp
// anywhere, and the callback leading only while it is closed.
const posts = (page: Page) => page.waitForRequest(r => r.method() === "POST" && new URL(r.url()).pathname === "/quote");

async function askForCallback(page: Page) {
  const details = page.locator("details#quote-callback");
  // The server orders by its own clock: the callback may already be open.
  if (!(await details.evaluate(d => (d instanceof HTMLDetailsElement ? d.open : false)))) await details.locator("summary").click();
  const form = page.locator("#quote-callback-form");
  await form.getByLabel("Téléphone").fill("07 12 34 56 78");
  await form.getByLabel("J’accepte d’être rappelé·e à ce numéro au sujet de ma demande.").check();
  const posted = posts(page);
  await form.getByRole("button", { name: "Être rappelé" }).click();
  return new URLSearchParams((await posted).postData() ?? "");
}

for (const javaScriptEnabled of [false, true]) {
  test.describe(`the callback, ${javaScriptEnabled ? "with" : "without"} JavaScript`, () => {
    test.use({ javaScriptEnabled, reducedMotion: "reduce" });

    test("posts the phone as a callback lead", async ({ page }) => {
      await page.goto("/fr");
      const body = await askForCallback(page);
      expect(body.get("channel")).toBe("callback");
      expect(body.get("mobile")).toBe("07 12 34 56 78");
      expect(body.get("location")).toBe("paris");
      // The sentence shown is what is posted, and what the lead keeps.
      expect(body.get("consent")).toBe("J’accepte d’être rappelé·e à ce numéro au sujet de ma demande.");
      await expect(page).toHaveURL(/\/fr\/thanks$/);
    });

    test("is refused without the consent", async ({ page }) => {
      await page.goto("/fr");
      const details = page.locator("details#quote-callback");
      if (!(await details.evaluate(d => (d instanceof HTMLDetailsElement ? d.open : false)))) await details.locator("summary").click();
      const form = page.locator("#quote-callback-form");
      await form.getByLabel("Téléphone").fill("07 12 34 56 78");
      await form.getByRole("button", { name: "Être rappelé" }).click();
      await expect(page).toHaveURL(/\/fr$/);
      expect(await form.getByLabel("J’accepte d’être rappelé·e à ce numéro au sujet de ma demande.").evaluate(el => (el instanceof HTMLInputElement ? el.validity.valueMissing : false))).toBe(true);
    });
  });
}

test.describe("the channel order", () => {
  const hydrated = (page: Page) => expect(page.locator("#quote select")).toHaveCount(0);
  const callbackFirst = (page: Page) =>
    page.evaluate(() => {
      const callback = document.getElementById("quote-callback");
      const form = document.getElementById("quote");
      if (!callback || !form) throw new Error("missing the form or the callback");
      return { first: Boolean(callback.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING), open: callback.hasAttribute("open") };
    });

  test("leads with the callback, open, and the next opening while closed", async ({ page }) => {
    // Friday 20:00 in Paris: closed until Monday 08:00.
    await page.clock.setFixedTime(new Date("2026-10-09T18:00:00Z"));
    await page.goto("/fr");
    await hydrated(page);
    expect(await callbackFirst(page)).toEqual({ first: true, open: true });
    await expect(page.getByText("Nous vous rappelons lundi dès 8 h.")).toBeVisible();
  });

  test("leads with the form while open, the callback closed after it", async ({ page }) => {
    // Monday 10:00 in Paris.
    await page.clock.setFixedTime(new Date("2026-10-05T08:00:00Z"));
    await page.goto("/fr");
    await hydrated(page);
    expect(await callbackFirst(page)).toEqual({ first: false, open: false });
    await expect(page.getByText(/Nous vous rappelons/)).toHaveCount(0);
  });
});

test("a place with no number offers no call, text or WhatsApp anywhere", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.locator("#quote")).toBeVisible();
  await expect(page.locator('a[href^="tel:"], a[href^="sms:"], a[href*="wa.me"]')).toHaveCount(0);
  await expect(page.locator("#callbar").getByText("☎")).toHaveCount(0);
});
