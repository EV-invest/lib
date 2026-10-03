import { expect, test, type Locator, type Page } from "@playwright/test";

// The quote form's contract with the visitor: it posts before any script
// (the one standing in water may be on a bad connection), and once the script
// is there the choice is the kit's list, not the platform's menu — in the
// same box, so nothing moves when one becomes the other.
const SUBJECT = "Prestation";

async function fillAndSend(page: Page) {
  // `#quote` is the card, the callback's phone in it too: the form is its own.
  const form = page.locator("#quote-form");
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
    await expect(page.locator("#quote-form").getByLabel("Code postal")).toBeFocused();
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
      await expect(page).toHaveURL(/\/fr\/thanks\?channel=callback$/);
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
      const form = document.getElementById("quote-form");
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

test("#quote is the whole card: the call bar's link lands on its head", async ({ page }) => {
  await page.goto("/fr#quote");
  const card = page.locator("#quote");
  await expect(card.getByText("Recevoir un prix", { exact: true })).toBeInViewport();
  await expect(card.locator("form#quote-form")).toHaveCount(1);
  await expect(card.locator("details#quote-callback")).toHaveCount(1);
});

// `LeadCapture`'s `done` posts the form itself and trusts one answer: the
// thanks page, reached through the 303. Held here against the real route.
test("a scripted post of the form lands on the thanks page", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.locator("#quote select")).toHaveCount(0);
  const form = page.locator("#quote-form");
  await form.getByLabel("Code postal").fill("75011");
  await form.getByLabel("Téléphone").fill("0612345678");
  const answer = await form.evaluate(async el => {
    if (!(el instanceof HTMLFormElement)) throw new Error("not a form");
    const body = new URLSearchParams();
    for (const [key, value] of new FormData(el)) if (typeof value === "string") body.append(key, value);
    const res = await fetch(el.action, { method: "POST", body });
    return { ok: res.ok, redirected: res.redirected, path: new URL(res.url).pathname };
  });
  expect(answer).toEqual({ ok: true, redirected: true, path: "/fr/thanks" });
});

// A number the server refuses: never silent, never lost (LEAD-FORMS-REVIEW-2026-10-03 #1).
const INVALID = "Ce numéro n’est pas valide. Exemple : 06 12 34 56 78 ou +33 6 12 34 56 78.";

test.describe("a refused number, without JavaScript", () => {
  test.use({ javaScriptEnabled: false, reducedMotion: "reduce" });

  test("goes back to the card, naming the field and keeping the need", async ({ page }) => {
    await page.goto("/fr#quote");
    const form = page.locator("#quote-form");
    await form.getByLabel("Code postal").fill("75011");
    await form.getByLabel("Téléphone").fill("06 12 34 56 7");
    await form.getByRole("button", { name: "Recevoir le prix" }).click();
    await expect(page).toHaveURL(/\/fr\?lead_error=phone&need=standard#quote$/);
  });
});

test.describe("a refused number, with JavaScript", () => {
  const hydrated = (page: Page) => expect(page.locator("#quote select")).toHaveCount(0);

  test("is blocked before it is sent, in the page's words", async ({ page }) => {
    await page.goto("/fr");
    await hydrated(page);
    let sent = 0;
    page.on("request", r => void (r.method() === "POST" && sent++));
    const form = page.locator("#quote-form");
    await form.getByLabel("Code postal").fill("75011");
    const phone = form.getByLabel("Téléphone");
    await phone.fill("+3361234567");
    await form.getByRole("button", { name: "Recevoir le prix" }).click();
    await expect(phone).toHaveAttribute("aria-invalid", "true");
    await expect(form.getByRole("alert")).toHaveText(INVALID);
    expect(await phone.evaluate(el => (el instanceof HTMLInputElement ? el.validationMessage : ""))).toBe(INVALID);
    expect(sent).toBe(0);
  });

  test("refused by the server, shows why at the field and keeps what was typed", async ({ page }) => {
    await page.goto("/fr");
    await hydrated(page);
    const form = page.locator("#quote-form");
    // Past the form's own check, as a stale page's would be.
    await form.evaluate(el => el instanceof HTMLFormElement && (el.noValidate = true));
    await form.getByLabel("Code postal").fill("75011");
    const phone = form.getByLabel("Téléphone");
    await phone.fill("0000000000");
    const answered = page.waitForResponse(r => new URL(r.url()).pathname === "/quote");
    await form.getByRole("button", { name: "Recevoir le prix" }).click();
    expect((await answered).status()).toBe(422);
    await expect(form.getByRole("alert")).toHaveText(INVALID);
    await expect(phone).toBeFocused();
    await expect(phone).toHaveValue("0000000000");
    await expect(form.getByLabel("Code postal")).toHaveValue("75011");
    await expect(page).toHaveURL(/\/fr$/);
  });

  test("brought back by the no-JS refusal, shows it at the field", async ({ page }) => {
    await page.goto("/fr?lead_error=phone&need=deep#quote");
    const form = page.locator("#quote-form");
    await expect(form.getByRole("alert")).toHaveText(INVALID);
    await expect(form.getByLabel("Téléphone")).toBeFocused();
    // The need came back with it: chosen, not asked again.
    await expect(form.locator("input[name=subject]")).toHaveValue("deep");
    await expect(form.getByText("Grand ménage")).toBeVisible();
    await expect(page).toHaveURL(/\/fr\?need=deep#quote$/);
  });
});

// No network at the press of submit: the form stays, says so, and sends the
// same lead once the network is back (LEAD-FORMS-REVIEW-2026-10-03 #4).
test("offline, the form says so, keeps what was typed and sends it on retry", async ({ page, context }) => {
  await page.goto("/fr");
  await expect(page.locator("#quote select")).toHaveCount(0);
  const form = page.locator("#quote-form");
  await form.getByLabel("Code postal").fill("75011");
  await form.getByLabel("Téléphone").fill("0612345678");
  await context.setOffline(true);
  await form.getByRole("button", { name: "Recevoir le prix" }).click();
  const alert = form.getByRole("alert");
  await expect(alert).toContainText("Pas de connexion");
  await expect(page).toHaveURL(/\/fr$/);
  await expect(form.getByLabel("Téléphone")).toHaveValue("0612345678");
  await context.setOffline(false);
  await alert.getByRole("button", { name: "Réessayer" }).click();
  await expect(page).toHaveURL(/\/fr\/thanks$/);
});
