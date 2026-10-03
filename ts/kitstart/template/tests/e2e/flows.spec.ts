import { expect, test, type Page } from "@playwright/test";

// The form variants: `recurring` is an estimate, priced live from the baked
// model (the mock panel's price list is down) and stored at the server's own
// price; the slot is then set by a call — no booking provider yet.

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

const quote = (page: Page) => page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/quote");

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

test("the server prices the posted answers itself: a posted amount is ignored", async ({ page }) => {
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
  const answered = quote(page);
  await form(page).getByRole("button", { name: "Réserver" }).click();
  // 45 € + 45 € + 10 € = 100 €, less 10 % = 90 €.
  expect(await (await answered).json()).toMatchObject({ ok: true, cents: 9000 });
  await expect(page.getByRole("status")).toContainText(/Demande enregistrée au prix de 90\s€\./);
});

test("a priced lead confirms the server's price and promises a call to set the slot, with no third party", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", r => void (new URL(r.url()).hostname !== "localhost" && outside.push(r.url())));
  await pickRecurring(page, "fr");
  await answer(page, "Studio");
  await answer(page, "Moins de 40 m²");
  await answer(page, "Une fois");
  await contact(page, "fr");
  const answered = quote(page);
  await form(page).getByRole("button", { name: "Réserver" }).click();
  expect(await (await answered).json()).toMatchObject({ ok: true, cents: 4900, lead: expect.stringMatching(/^lead-\d+-[0-9a-f]{8}$/) });
  const status = page.getByRole("status");
  // 45 €, under the 49 € minimum.
  await expect(status).toContainText(/Demande enregistrée au prix de 49\s€\./);
  await expect(status).toContainText("Nous vous rappelons pour fixer le créneau.");
  await expect(status).toBeFocused();
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(outside).toEqual([]);
});

test("in English too", async ({ page }) => {
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
});

test("a quote need is the form it always was", async ({ page }) => {
  await page.goto("/fr");
  await hydrated(page);
  await expect(form(page).locator("input[name^=estimate_]")).toHaveCount(0);
  await expect(form(page).getByRole("button", { name: "Recevoir le prix" })).toBeVisible();
});
