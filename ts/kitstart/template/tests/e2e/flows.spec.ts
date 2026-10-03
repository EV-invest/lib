import { expect, test, type Page } from "@playwright/test";
import { PRICING } from "../../src/shared/config/pricing";

// The form variants: `recurring` is an estimate, priced live from the baked
// model (the mock panel's price list is down) and stored at the server's own
// price — the price shown, or the lead is sent back to confirm a fresh one.
// The slot is then booked on the Cal.com event the panel set for the place
// (the French page), or — the default, `manual` (the English one) — promised
// by a call with an optional preference.

const hydrated = (page: Page) => expect(page.locator("#quote select")).toHaveCount(0);

async function pickRecurring(page: Page, locale: "fr" | "en") {
  await page.goto(`/${locale}`);
  await hydrated(page);
  await page.getByRole("combobox", { name: locale === "fr" ? "Prestation" : "Service" }).click();
  await page.getByRole("listbox").getByRole("option", { name: locale === "fr" ? "Ménage régulier" : "Recurring cleaning" }).click();
}

const form = (page: Page) => page.locator("#quote-form");
const answer = (page: Page, label: string) => form(page).getByRole("radio", { name: label, exact: true }).check();
const price = (page: Page) => form(page).locator("[data-price-cents]");

async function contact(page: Page, locale: "fr" | "en") {
  await form(page).getByLabel(locale === "fr" ? "Code postal" : "Postcode").fill("75011");
  await form(page).getByLabel(locale === "fr" ? "Téléphone" : "Phone").fill("0612345678");
}

/** The template's list as the panel serves it after a change: no monthly discount, nothing else. */
const LIVE_PRICING = {
  ...PRICING,
  inputs: PRICING.inputs.map(i => (i.id === "frequency" ? { ...i, options: i.options.map(o => (o.id === "monthly" ? { ...o, discountBp: 0 } : o)) } : i)),
};

const quote = (page: Page) => page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/quote");
const outsideRequests = (page: Page): string[] => {
  const outside: string[] = [];
  page.on("request", r => void (new URL(r.url()).hostname !== "localhost" && outside.push(r.url())));
  return outside;
};

test("an estimate prices the answers live, from the baked model while the panel's is down", async ({ page }) => {
  await pickRecurring(page, "fr");
  await expect(form(page).getByText("Répondez aux questions pour voir le prix.")).toBeVisible();
  await expect(price(page)).toHaveCount(0);
  await answer(page, "2 chambres");
  await answer(page, "40 à 70 m²");
  await answer(page, "Toutes les 2 semaines");
  // 45 € + 30 € + 10 € = 85 €, less 10 % = 76,50 €, to the euro: 77 €.
  await expect(price(page)).toHaveAttribute("data-price-cents", "7700");
  await answer(page, "Une fois");
  await expect(price(page)).toHaveAttribute("data-price-cents", "8500");
  await expect(form(page).getByRole("button", { name: "Réserver" })).toBeVisible();
});

test("the server prices the posted answers itself, and takes a lead only at the price shown", async ({ page }) => {
  await pickRecurring(page, "fr");
  await answer(page, "2 chambres");
  await answer(page, "40 à 70 m²");
  await answer(page, "Toutes les 2 semaines");
  await expect(price(page)).toHaveAttribute("data-price-cents", "7700");
  await contact(page, "fr");
  // A tampered page: a price of its own, and an answer the screen did not price.
  await form(page).evaluate(el => {
    for (const name of ["quoted_cents", "cents", "price"]) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = "1";
      el.append(input);
    }
    const t3 = el.querySelector<HTMLInputElement>("input[name=estimate_bedrooms][value=t3]");
    if (t3) t3.value = "t4";
  });
  const refused = quote(page);
  await form(page).getByRole("button", { name: "Réserver" }).click();
  // 45 € + 45 € + 10 € = 100 €, less 10 % = 90 € — not the 77 € shown: confirmed first.
  expect(await (await refused).json()).toEqual({ ok: false, field: "price_changed", reason: "price_changed", cents: 9000 });
  await expect(form(page)).toContainText(/Le prix a changé : 90\s€ au lieu de 77\s€\./);
  await expect(price(page)).toHaveAttribute("data-price-cents", "9000");
  // The re-render put the radio's value back; the tampered answer again, then the confirm.
  await form(page).evaluate(el => {
    const t3 = el.querySelector<HTMLInputElement>("input[name=estimate_bedrooms][value=t3]");
    if (t3) t3.value = "t4";
  });
  const answered = quote(page);
  await form(page).getByRole("button", { name: "Réserver" }).click();
  expect(await (await answered).json()).toMatchObject({ ok: true, cents: 9000 });
  await expect(page.getByRole("status")).toContainText(/Demande enregistrée au prix de 90\s€\./);
});

// Live retest 2026-10-04: shown 77 €, the tariff changed in the panel, taken at 86 € without a word.
test("a tariff changed under an open page is shown and confirmed, never recorded silently", async ({ page, request }) => {
  await pickRecurring(page, "fr");
  await answer(page, "1 chambre");
  await answer(page, "Moins de 40 m²");
  await answer(page, "Chaque mois");
  // 45 € + 15 € = 60 €, less 5 % = 57 €.
  await expect(price(page)).toHaveAttribute("data-price-cents", "5700");
  await contact(page, "fr");
  // The panel serves its own list from now on. Only the monthly discount
  // differs, so the other tests, sharing the server, price as before.
  await request.post(`http://127.0.0.1:${process.env["E2E_MOCK_PORT"]}/_e2e/pricing`, { data: LIVE_PRICING });
  const refused = quote(page);
  await form(page).getByRole("button", { name: "Réserver" }).click();
  expect(await (await refused).json()).toMatchObject({ ok: false, reason: "price_changed", cents: 6000 });
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(form(page)).toContainText(/Le prix a changé : 60\s€ au lieu de 57\s€\./);
  const answered = quote(page);
  await form(page).getByRole("button", { name: "Réserver" }).click();
  expect(await (await answered).json()).toMatchObject({ ok: true, cents: 6000 });
  await expect(page.getByRole("status")).toContainText(/Demande enregistrée au prix de 60\s€\./);
});

test("a priced lead offers the place's Cal.com, prefilled, loading nothing of it before the click", async ({ page, context }) => {
  const outside = outsideRequests(page);
  // The booking page itself is not under test: answered here, never fetched.
  await context.route("https://cal.com/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Cal.com</title>" }));
  await pickRecurring(page, "fr");
  await answer(page, "Studio");
  await answer(page, "Moins de 40 m²");
  await answer(page, "Une fois");
  await contact(page, "fr");
  const answered = quote(page);
  await form(page).getByRole("button", { name: "Réserver" }).click();
  const lead = (await (await answered).json()) as { lead: string };
  expect(lead).toMatchObject({ ok: true, cents: 4900, lead: expect.stringMatching(/^lead-\d+-[0-9a-f]{8}$/) });
  const status = page.getByRole("status");
  // 45 €, under the 49 € minimum.
  await expect(status).toContainText(/Demande enregistrée au prix de 49\s€\./);
  await expect(status).toBeFocused();
  const book = status.getByRole("link", { name: "Choisir un créneau" });
  await expect(book).toHaveAttribute("href", `https://cal.com/brand/menage?attendeePhoneNumber=%2B33612345678&metadata[ref]=${lead.lead}`);
  await expect(status).toContainText("Sinon, nous vous rappelons pour fixer le créneau.");
  await expect(page.locator("iframe, script[src*='cal.com']")).toHaveCount(0);
  expect(outside).toEqual([]);

  const requested = page.waitForResponse(r => new URL(r.url()).pathname === "/quote/booking");
  const popup = page.waitForEvent("popup");
  await book.click();
  const tab = await popup;
  await tab.waitForLoadState();
  expect(new URL(tab.url()).searchParams.get("metadata[ref]")).toBe(lead.lead);
  const res = await requested;
  expect(JSON.parse(res.request().postData() ?? "{}")).toMatchObject({ lead_ref: lead.lead, provider: "cal_com" });
  // Taken; with no lead webhook in the template, `panelBooking` is off and nothing is queued (unit-tested).
  expect(res.status()).toBe(200);
});

test("in English, where the place has no booking of its own: a call, an optional preference, no third party", async ({ page }) => {
  const outside = outsideRequests(page);
  await pickRecurring(page, "en");
  await answer(page, "1 bedroom");
  await answer(page, "Over 70 m²");
  await answer(page, "Every week");
  // 45 € + 15 € + 25 € = 85 €, less 15 % = 72,25 €, to the euro: 72 €.
  await expect(price(page)).toHaveAttribute("data-price-cents", "7200");
  await contact(page, "en");
  await form(page).getByRole("button", { name: "Book" }).click();
  const status = page.getByRole("status");
  await expect(status).toContainText("Request saved at €72.");
  await expect(status).toContainText("We will call you to set the slot.");
  await expect(status.getByRole("link")).toHaveCount(0);
  const send = status.getByRole("button", { name: "Send my preference" });
  await expect(send).toBeDisabled();
  await status.getByRole("radio", { name: "Evening", exact: true }).check();
  const requested = page.waitForResponse(r => new URL(r.url()).pathname === "/quote/booking");
  await send.click();
  const res = await requested;
  expect(JSON.parse(res.request().postData() ?? "{}")).toMatchObject({ provider: "manual", preferred_part: "evening", lead_ref: expect.stringMatching(/^lead-/) });
  expect(res.status()).toBe(200);
  await expect(status).toContainText("Noted: we will keep it in mind when we call.");
  expect(outside).toEqual([]);
});

test("a quote need is the form it always was", async ({ page }) => {
  await page.goto("/fr");
  await hydrated(page);
  await expect(form(page).locator("input[name^=estimate_]")).toHaveCount(0);
  await expect(form(page).getByRole("button", { name: "Recevoir le prix" })).toBeVisible();
});
