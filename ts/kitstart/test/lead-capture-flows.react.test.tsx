import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AnalyticsSink } from "@evinvest/analytics";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEAD_CAPTURE_TEXT, leadErrorOf, parsePricingModel, type LeadCaptureText, type OpeningHours, type Place } from "../src/index";
import { AnalyticsSinkContext } from "../src/react/analytics-context";
import { LeadCapture, type LeadCaptureProps } from "../src/react/index";
import { navigation } from "../src/react/use-lead-submit";
import { serviceAreaPlace } from "../src/testing/index";

const MODEL = parsePricingModel(JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/pricing/valid/cleaning.json"), "utf8")));
const WEEKDAYS: readonly OpeningHours[] = [{ days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "19:00" }];
const MONDAY_10H = new Date("2026-10-05T08:00:00Z").getTime();
const MOBILE = "+33 6 12 34 56 78";
const NEEDS = [
  { value: "standard", label: "Ménage courant" },
  { value: "windows", label: "Vitres" },
  { value: "deep", label: "Grand ménage" },
];
const FLOWS = { standard: "estimate", windows: "fixed", deep: "quote" } as const;
const place: Place<"fr" | "en"> = serviceAreaPlace(["fr", "en"], { hours: WEEKDAYS });

function capture(over: Partial<LeadCaptureProps> = {}): ReactElement {
  return (
    <LeadCapture
      place={place}
      contact={{ phone: MOBILE, whatsapp: MOBILE }}
      locale="fr"
      renderedAt={MONDAY_10H}
      wire={{ subject: "job", locality: "zip", mobile: "mobile" }}
      needs={NEEDS}
      flows={FLOWS}
      pricing={MODEL}
      photos={["deep"]}
      name={{ field: "name" }}
      text={LEAD_CAPTURE_TEXT.fr}
      {...over}
    />
  );
}

function recorder() {
  const events: { event: string; props: Record<string, unknown> }[] = [];
  const sink: AnalyticsSink = { capture: (event, props) => void events.push({ event, props: { ...props } }) };
  return { events, wrap: (node: ReactElement) => <AnalyticsSinkContext.Provider value={sink}>{node}</AnalyticsSinkContext.Provider> };
}

const form = () => {
  const el = document.getElementById("quote-form");
  if (!(el instanceof HTMLFormElement)) throw new Error("no form");
  return el;
};
const answer = (input: string, option: string) => {
  const el = form().querySelector(`input[name=estimate_${input}][value=${option}]`);
  if (!(el instanceof HTMLInputElement)) throw new Error(`no answer ${input}=${option}`);
  fireEvent.click(el);
};
const answerAll = () => {
  answer("zone", "proche");
  answer("bedrooms", "t3");
  answer("surface", "s70");
  answer("frequency", "biweekly");
};
const total = () => form().querySelector("[data-price-cents]")?.getAttribute("data-price-cents") ?? null;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MONDAY_10H);
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("LeadCapture's flows, without a script", () => {
  it("asks an estimate's questions as tiles that post, says the price comes with the answers, and books", () => {
    document.body.innerHTML = renderToString(capture());
    const f = form();
    expect([...new Set([...f.querySelectorAll<HTMLInputElement>("input[type=radio][name^=estimate_]")].map(i => i.name))]).toEqual([
      "estimate_zone",
      "estimate_bedrooms",
      "estimate_surface",
      "estimate_frequency",
    ]);
    // Not required before the script: an unanswered estimate is still a lead, a quote.
    expect(f.querySelector("input[name=estimate_zone]")?.hasAttribute("required")).toBe(false);
    expect(f).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.pricePending ?? "");
    expect(f).not.toHaveTextContent(/à partir de|dès/i);
    expect(within(f).getByRole("button", { name: "Réserver" })).toBeTruthy();
    expect(f.querySelector("[name*=cents], [name*=price]")).toBeNull();
  });

  it("shows a fixed need's price as is", () => {
    document.body.innerHTML = renderToString(capture({ need: "windows" }));
    expect(total()).toBe("8900");
    expect(form()).toHaveTextContent(/89\s€/);
    expect(form().querySelector("input[name^=estimate_]")).toBeNull();
  });

  it("leaves a quote need as it was", () => {
    document.body.innerHTML = renderToString(capture({ need: "deep", photos: [] }));
    expect(form().querySelector("[aria-live][class*=bg-card]")).toBeNull();
    expect(within(form()).getByRole("button", { name: "Recevoir le prix" })).toBeTruthy();
  });

  it("is a quote form for every need without a price list, or one that does not price the need", () => {
    document.body.innerHTML = renderToString(capture({ pricing: null }));
    expect(form().querySelector("input[name^=estimate_]")).toBeNull();
    expect(within(form()).getByRole("button", { name: "Recevoir le prix" })).toBeTruthy();
    document.body.innerHTML = renderToString(capture({ pricing: { ...MODEL, needs: {} } }));
    expect(form().querySelector("input[name^=estimate_]")).toBeNull();
  });
});

describe("LeadCapture's estimate, with a script", () => {
  it("prices the answers live, with how, read out, and reprices on a change", () => {
    render(capture());
    expect(total()).toBeNull();
    answerAll();
    expect(total()).toBe("8400");
    const box = form().querySelector("[data-price-cents]")?.closest("[aria-live]");
    expect(box?.getAttribute("aria-live")).toBe("polite");
    expect(box).toHaveTextContent(/2 chambres\+30\s€/);
    expect(box).toHaveTextContent(/Toutes les 2 semaines−9,35\s€/);
    expect(box).toHaveTextContent(/Arrondi−0,15\s€/);
    answer("frequency", "once");
    expect(total()).toBe("9400");
    // Required once the script runs: a price needs every answer.
    expect(form().querySelector<HTMLInputElement>("input[name=estimate_zone]")?.required).toBe(true);
  });

  it("reports the price's band once per band, never the price", () => {
    const { events, wrap } = recorder();
    render(wrap(capture()));
    answerAll();
    answer("frequency", "weekly");
    answer("frequency", "biweekly");
    answer("frequency", "once");
    const shown = events.filter(e => e.event === "lead_estimate_shown").map(e => e.props);
    expect(shown).toEqual([
      expect.objectContaining({ need: "standard", cents_bucket: "7500-10000", form_id: "quote" }),
    ]);
    expect(JSON.stringify(shown)).not.toMatch(/8400|9400|8000/);
  });

  it("offers photos by WhatsApp for a quote need that asks for them, only with a WhatsApp", () => {
    render(capture({ need: "deep" }));
    const link = within(form()).getByRole("link", { name: "Envoyer des photos sur WhatsApp" });
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain("Bonjour, voici des photos pour : Grand ménage.");
    document.body.innerHTML = "";
    render(capture({ need: "deep", contact: { phone: MOBILE, whatsapp: null } }));
    expect(within(form()).queryByRole("link", { name: "Envoyer des photos sur WhatsApp" })).toBeNull();
  });
});

describe("LeadCapture's priced success", () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  const taken = { ok: true, location: "/fr/thanks", lead: "lead-12-0a1b2c3d", cents: 8400 };

  async function send(fetchAnswer: unknown = taken) {
    const fetch = vi.fn(async () => json(fetchAnswer));
    vi.stubGlobal("fetch", fetch);
    const f = form();
    fireEvent.change(f.querySelector("input[name=zip]") as HTMLInputElement, { target: { value: "75011" } });
    fireEvent.change(f.querySelector("input[name=mobile]") as HTMLInputElement, { target: { value: "06 12 34 56 78" } });
    fireEvent.change(f.querySelector("input[name=name]") as HTMLInputElement, { target: { value: "Ana" } });
    await act(async () => {
      fireEvent.submit(f);
      await Promise.resolve();
    });
    return fetch;
  }

  it("stores the lead, then confirms the server's price and promises a call to set the slot", async () => {
    const { events, wrap } = recorder();
    render(wrap(capture()));
    answerAll();
    const fetch = await send();
    const body = Object.fromEntries((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams);
    expect(body).toMatchObject({ job: "standard", estimate_zone: "proche", estimate_bedrooms: "t3", estimate_surface: "s70", estimate_frequency: "biweekly" });
    // The price is the server's to set: only what the page showed is posted, for the server to compare.
    expect(Object.keys(body).filter(k => /cents|price|amount/.test(k))).toEqual(["shown_cents"]);
    expect(body.shown_cents).toBe("8400");
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/Demande enregistrée au prix de 84\s€\./);
    expect(status).toHaveTextContent("Nous vous rappelons pour fixer le créneau.");
    expect(document.activeElement).toBe(status);
    expect(document.querySelectorAll("iframe, script")).toHaveLength(0);
    expect(JSON.stringify(events)).not.toMatch(/06 12|Ana|lead-12/);
  });

  it("shows the brand's booking in place of the promise, given the lead", async () => {
    const booking = vi.fn((sent: { lead?: string }) => <p>Réservez : {sent.lead}</p>);
    render(capture({ need: "windows", booking }));
    await send({ ...taken, cents: 8900 });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/89\s€/);
    expect(status).toHaveTextContent("Réservez : lead-12-0a1b2c3d");
    expect(status).not.toHaveTextContent("Nous vous rappelons pour fixer le créneau.");
  });

  it("offers the place's Cal.com booking, prefilled with the lead, loading nothing of Cal.com's", async () => {
    render(capture({ need: "windows", place: { ...place, booking: { default: "cal_com", providers: { cal_com: { url: "https://cal.com/brand/vitres" } } } } }));
    await send({ ...taken, cents: 8900 });
    const link = screen.getByRole("link", { name: "Choisir un créneau" });
    expect(link.getAttribute("href")).toMatch(/^https:\/\/cal\.com\/brand\/vitres\?name=Ana&attendeePhoneNumber=%2B33612345678&metadata\[ref\]=lead-12-0a1b2c3d$/);
    expect(document.querySelectorAll("iframe, script")).toHaveLength(0);
  });

  // Live retest 2026-10-04: shown 77 €, recorded 86 € without a word.
  it("says the price changed, shows the fresh one, and takes the lead on a confirm at that price", async () => {
    const { events, wrap } = recorder();
    render(wrap(capture()));
    answerAll();
    const refused = await send({ ok: false, field: "price_changed", reason: "price_changed", cents: 9900 });
    const first = Object.fromEntries((refused.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams);
    expect(first.shown_cents).toBe("8400");
    expect(screen.queryByRole("status")).toBeNull();
    expect(form()).toHaveTextContent(/Le prix a changé : 99\s€ au lieu de 84\s€\./);
    expect(total()).toBe("9900");
    const confirmed = await send({ ...taken, cents: 9900 });
    const second = Object.fromEntries((confirmed.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams);
    expect(second.shown_cents).toBe("9900");
    expect(screen.getByRole("status")).toHaveTextContent(/99\s€/);
    expect(JSON.stringify(events)).not.toMatch(/9900|8400/);
  });

  // Review of #185: the refusal stayed above the submit after the answers changed.
  it("takes the price-changed words away once the answers change", async () => {
    render(capture());
    answerAll();
    await send({ ok: false, field: "price_changed", reason: "price_changed", cents: 9900 });
    expect(form()).toHaveTextContent(/Le prix a changé/);
    answer("frequency", "once");
    expect(form()).not.toHaveTextContent(/Le prix a changé/);
  });

  it("says the price changed on a page the server sent back, without a script", () => {
    document.body.innerHTML = renderToString(capture({ need: "windows", initialError: leadErrorOf({ lead_error: "price_changed" }) }));
    expect(document.body).toHaveTextContent("Le prix a changé depuis l’affichage de la page. Vérifiez le nouveau prix et confirmez.");
    expect(document.querySelector("input[name=shown_cents]")?.getAttribute("value")).toBe("8900");
  });

  it("offers the provider the booking_provider variant names, with the phone hint for Google", async () => {
    const booking = { default: "manual", providers: { google_calendar: { url: "https://calendar.app.google/AbC123xyz" } } } as const;
    render(capture({ need: "windows", place: { ...place, booking }, bookingVariant: "google_calendar" }));
    await send({ ...taken, cents: 8900 });
    expect(screen.getByRole("link", { name: "Choisir un créneau" })).toHaveAttribute("href", "https://calendar.app.google/AbC123xyz");
    expect(screen.getByRole("status")).toHaveTextContent("Indiquez le même numéro de téléphone en réservant");
  });

  it("offers the place's default to a visitor outside the experiment", async () => {
    const booking = { default: "manual", providers: { google_calendar: { url: "https://calendar.app.google/AbC123xyz" } } } as const;
    render(capture({ need: "windows", place: { ...place, booking } }));
    await send({ ...taken, cents: 8900 });
    expect(screen.queryByRole("link", { name: "Choisir un créneau" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Nous vous rappelons pour fixer le créneau.");
  });

  it("still goes to the thanks page for a quote need", async () => {
    const assign = vi.spyOn(navigation, "assign").mockImplementation(() => {});
    render(capture({ need: "deep" }));
    await send({ ok: true, location: "/fr/thanks" });
    expect(assign).toHaveBeenCalledWith("/fr/thanks");
    assign.mockRestore();
  });

  it("speaks English on an English page, kit words included when the brand's text predates them", () => {
    const older: LeadCaptureText = { ...LEAD_CAPTURE_TEXT.en };
    delete older.pricePending;
    delete older.bookSubmit;
    render(capture({ locale: "en", text: older }));
    expect(within(form()).getByRole("button", { name: "Book" })).toBeTruthy();
    expect(form()).toHaveTextContent("Answer the questions to see the price.");
    expect(form()).toHaveTextContent("Inner suburbs");
  });
});
