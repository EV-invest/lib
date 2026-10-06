import { expect, test, type Locator, type Page } from "@playwright/test";

// The prices page's estimate (`EstimateCard`): `LeadCapture` one question a
// screen. The intro first — urgent is a call back, the phone alone — then the
// need as cards, the regular clean's answers (the surface may be "I don't
// know", the frequency is cards that carry their price), the postcode, and
// the phone last under the price on one line.

const form = (page: Page) => page.locator("#estimate-form");
const screenOn = (page: Page) => form(page).locator("[data-lead-step]:not([data-lead-off])");
// The radio lies over its tile, as a finger meets it: a tap on the tile is a tap on the radio.
const tile = (page: Page, name: string) =>
  screenOn(page)
    .locator("label")
    .filter({ has: page.getByText(name, { exact: true }) })
    .locator("input[type=radio]");
const quote = (page: Page) => page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/quote");

async function open(page: Page) {
  // Monday 10:00 in Paris: open, so the folded callback is below the form, not leading it.
  await page.clock.setFixedTime(new Date("2026-10-05T08:00:00Z"));
  await page.goto("/fr/prices");
  // Hydrated: the bar and the way back are the script's; without it the noscript style hides them.
  await expect(form(page).locator("[data-lead-chrome]").first()).toBeVisible();
}

const height = (l: Locator) => l.evaluate(el => el.getBoundingClientRect().height);

test("one question a screen, the answers kept as chips, the price on one line with the tax credit, and booked", async ({ page }) => {
  await open(page);
  await expect(screenOn(page)).toHaveAttribute("data-lead-step", "intro");
  // The intro picks the branch, and so how many screens follow: no total said before it.
  await expect(form(page).getByText("Étape 1", { exact: true })).toBeAttached();
  // Touch-sized on a phone as on a desk.
  expect(await height(tile(page, "Cette semaine").locator(".."))).toBeGreaterThanOrEqual(44);
  expect(await height(form(page).getByRole("button", { name: "Retour" }).or(tile(page, "Je compare")).first())).toBeGreaterThanOrEqual(44);
  await tile(page, "Cette semaine").click();
  await expect(screenOn(page)).toHaveAttribute("data-lead-step", "need");
  // Cards, each with the brand's icon.
  await expect(screenOn(page).locator("svg")).toHaveCount(4);
  await tile(page, "Ménage régulier").click();
  await tile(page, "2 chambres").click();
  await tile(page, "40 à 70 m²").click();
  await expect(screenOn(page)).toHaveAttribute("data-lead-step", "estimate_frequency");
  // 45 € + 30 € + 10 € = 85 €: less 15 % → 72 €, 10 % → 77 €, 5 % → 81 €.
  const card = (name: string) => screenOn(page).locator("label").filter({ hasText: name });
  await expect(card("Chaque semaine")).toContainText(/72\s€/);
  await expect(card("Toutes les 2 semaines")).toContainText(/77\s€/);
  await expect(card("Toutes les 2 semaines")).toContainText("Le plus avantageux");
  await expect(card("Une fois")).toContainText(/85\s€/);
  await tile(page, "Toutes les 2 semaines").click();
  // The place serves one commune: the postcode is answered already, a chip — on to the phone.
  await expect(screenOn(page)).toHaveAttribute("data-lead-step", "phone");
  await expect(form(page).getByLabel("Téléphone")).toBeFocused();
  await expect(form(page).locator("[data-price-cents]")).toHaveText(/Votre prix : 77\s€/);
  await expect(form(page).locator("[data-credit-cents]")).toContainText(/38,50\s€ après crédit d’impôt/);
  await expect(screenOn(page).getByText("Votre numéro reste entre nous — rappel sous 15 min.")).toBeVisible();
  // The answers, a tap back each; the way back one screen.
  const chips = form(page).locator("[data-lead-chrome] li");
  await expect(chips).toHaveCount(6);
  await expect(chips.last()).toContainText("Paris");
  await form(page).getByRole("button", { name: "Retour" }).click();
  await expect(screenOn(page)).toHaveAttribute("data-lead-step", "locality");
  await expect(form(page).getByLabel("Code postal")).toHaveValue("Paris");
  await form(page).getByLabel("Code postal").fill("75011");
  await form(page).getByLabel("Code postal").press("Enter");
  await expect(screenOn(page)).toHaveAttribute("data-lead-step", "phone");
  await expect(form(page).getByLabel("Téléphone")).toBeFocused();
  await form(page).getByLabel("Téléphone").fill("0612345678");
  const answered = quote(page);
  await form(page).getByRole("button", { name: "Réserver" }).click();
  const res = await answered;
  const body = Object.fromEntries(new URLSearchParams(res.request().postData() ?? ""));
  expect(body).toMatchObject({ urgency: "week", subject: "recurring", estimate_bedrooms: "t3", estimate_surface: "s70", estimate_frequency: "biweekly", locality: "75011", shown_cents: "7700" });
  expect(await res.json()).toMatchObject({ ok: true, cents: 7700 });
  await expect(page.getByRole("status")).toContainText(/Demande enregistrée au prix de 77\s€\./);
});

test("\"Je ne sais pas\" makes the regular clean a quote: the questions after it go, no price, the thanks page", async ({ page }) => {
  await open(page);
  await tile(page, "Je compare").click();
  await tile(page, "Ménage régulier").click();
  await tile(page, "Studio").click();
  await tile(page, "Je ne sais pas").click();
  // The questions after it go; the commune the place serves is answered already.
  await expect(screenOn(page)).toHaveAttribute("data-lead-step", "phone");
  await expect(form(page).getByText("Étape 6/6")).toBeAttached();
  await expect(form(page).locator("[data-price-cents]")).toHaveCount(0);
  await form(page).getByLabel("Téléphone").fill("0612345678");
  const answered = quote(page);
  await form(page).getByRole("button", { name: "Recevoir le prix" }).click();
  const res = await answered;
  const body = new URLSearchParams(res.request().postData() ?? "");
  expect(body.get("estimate_surface")).toBe("?");
  expect(body.has("estimate_frequency")).toBe(false);
  expect(body.has("shown_cents")).toBe(false);
  // A quote leaves for the thanks page; a priced lead would have stayed in the card.
  await expect(page).toHaveURL(/\/fr\/thanks$/);
});

test("urgent is a call back: the phone and its consent, posted as a callback with the urgency", async ({ page }) => {
  await open(page);
  await tile(page, "Urgent — aujourd’hui").click();
  await expect(screenOn(page)).toHaveAttribute("data-lead-step", "phone");
  await expect(form(page).getByText("Étape 2/2")).toBeAttached();
  await expect(page.locator("#estimate-callback")).toHaveCount(0);
  await form(page).getByLabel("Téléphone").fill("0712345678");
  await form(page).getByLabel("J’accepte d’être rappelé·e à ce numéro au sujet de ma demande.").check();
  const answered = quote(page);
  await form(page).getByRole("button", { name: "Être rappelé" }).click();
  const body = new URLSearchParams((await answered).request().postData() ?? "");
  expect(body.get("channel")).toBe("callback");
  expect(body.get("urgency")).toBe("today");
  await expect(page).toHaveURL(/\/fr\/thanks\?channel=callback$/);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false, reducedMotion: "reduce" });

  test("every screen is there at once, and the form posts as one", async ({ page }) => {
    await page.goto("/fr/prices");
    await expect(form(page).locator("[data-lead-chrome]").first()).toBeHidden();
    await expect(form(page).getByLabel("Téléphone")).toBeVisible();
    await form(page).locator("label").filter({ has: page.getByText("Autre", { exact: true }) }).locator("input").check();
    await form(page).getByLabel("Code postal").fill("75011");
    await form(page).getByLabel("Téléphone").fill("0612345678");
    const posted = page.waitForRequest(r => r.method() === "POST" && new URL(r.url()).pathname === "/quote");
    await form(page).getByRole("button", { name: "Recevoir le prix" }).click();
    expect(new URLSearchParams((await posted).postData() ?? "").get("subject")).toBe("other");
    await expect(page).toHaveURL(/\/fr\/thanks$/);
  });
});

test("the home page's form takes the postcode the link carries", async ({ page }) => {
  await page.goto("/fr?postcode=75011");
  await expect(page.locator("#quote select")).toHaveCount(0);
  await expect(page.locator("#quote-form").getByLabel("Code postal")).toHaveValue("75011");
});
