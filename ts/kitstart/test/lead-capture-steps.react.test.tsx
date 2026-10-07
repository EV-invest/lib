import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AnalyticsSink } from "@evinvest/analytics";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ESTIMATE_UNKNOWN, flowTextOf, LEAD_CAPTURE_TEXT, leadErrorOf, parsePricingModel, priceOf, type OpeningHours, type Place } from "../src/index";
import { AnalyticsSinkContext } from "../src/react/analytics-context";
import { LeadCapture, type LeadCaptureProps } from "../src/react/index";
import { PriceCompact } from "../src/react/LeadCapturePrice";
import { serviceAreaPlace } from "../src/testing/index";

// `layout="steps"` and the compact form's pieces: one question per screen,
// the phone last, what the page knows never asked twice.

const MODEL = parsePricingModel(JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/pricing/valid/cleaning.json"), "utf8")));
const WEEKDAYS: readonly OpeningHours[] = [{ days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "19:00" }];
const MONDAY_10H = new Date("2026-10-05T08:00:00Z").getTime();
const MOBILE = "+33 6 12 34 56 78";
const NEEDS = [
  { value: "standard", label: "Ménage courant", icon: <svg data-icon="standard" /> },
  { value: "windows", label: "Vitres", icon: <svg data-icon="windows" /> },
  { value: "deep", label: "Grand ménage" },
];
const FLOWS = { standard: "estimate", windows: "fixed", deep: "quote" } as const;
const place: Place<"fr" | "en"> = serviceAreaPlace(["fr", "en"], { hours: WEEKDAYS });
const fr = LEAD_CAPTURE_TEXT.fr;

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
      text={fr}
      layout="steps"
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
const posted = () => Object.fromEntries(new FormData(form()));
/** The screen on: the one step not hidden. */
const shown = () => [...form().querySelectorAll<HTMLElement>("[data-lead-step]")].filter(s => !s.hasAttribute("data-lead-off") && s.style.display !== "none").map(s => s.dataset["leadStep"]);
const radio = (name: string, value: string) => {
  const el = form().querySelector(`input[type=radio][name="${name}"][value="${value}"]`);
  if (!(el instanceof HTMLInputElement)) throw new Error(`no radio ${name}=${value}`);
  return el;
};
const field = (name: string) => {
  const el = form().querySelector(`input[name="${name}"]:not([type=radio])`);
  if (!(el instanceof HTMLInputElement)) throw new Error(`no field ${name}`);
  return el;
};
/**
 * A pointer's tap on a tile's radio, as each engine delivers it. Chromium: the
 * radio covers the tile, so the pointer and the click (`detail` 1) are its own.
 * WebKit: the tap may land on the tile's face, and the radio gets only the
 * label's click, `detail` 0 — the `detail` a keyboard's click has too. jsdom's
 * own label forwarding keeps the user's `detail`, so the radio's click is fired here.
 */
const ENGINES = ["chromium", "webkit"] as const;
const tapIn = (engine: (typeof ENGINES)[number]) => (el: Element) => {
  if (engine === "chromium") {
    fireEvent.pointerDown(el);
    fireEvent.click(el, { detail: 1 });
    return;
  }
  const face = el.nextElementSibling;
  if (!face) throw new Error("no tile face beside the radio");
  fireEvent.pointerDown(face);
  fireEvent.pointerUp(face);
  fireEvent.click(el, { detail: 0 });
};
const progress = () => form().querySelector("[data-lead-chrome] .sr-only")?.textContent;
const steps = (events: { event: string; props: Record<string, unknown> }[]) => events.filter(e => e.event === "lead_form_step").map(e => e.props["step"]);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MONDAY_10H);
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("LeadCapture's steps, without a script", () => {
  it("draws the first screen only, the rest in the form and revealed by a noscript style", () => {
    document.body.innerHTML = renderToString(capture());
    expect(shown()).toEqual(["need"]);
    expect(form().querySelectorAll("[data-lead-step]")).toHaveLength(3);
    // Every screen posts, hidden or not: the phone is in the form from the start.
    expect(field("mobile")).toBeTruthy();
    expect(field("zip")).toBeTruthy();
    expect(form().querySelector("noscript")?.innerHTML).toContain("[data-lead-step]{display:flex!important}");
    // The need may bring an estimate's four questions: counted until it is known, so the bar never moves back.
    expect(progress()).toBe("Étape 1/7");
    expect(form()).toHaveAttribute("data-lead-steps");
  });

  it("hydrates what the server drew without a mismatch: the same screen, before and after the script", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const container = document.createElement("div");
    container.innerHTML = renderToString(capture({ need: "standard", intro: undefined }));
    document.body.append(container);
    const root = await act(async () => hydrateRoot(container, capture({ need: "standard" })));
    expect(errors).not.toHaveBeenCalled();
    expect(shown()).toEqual(["estimate_zone"]);
    act(() => root.unmount());
    errors.mockRestore();
  });

  it("puts the compact price's breakdown in a <details> behind Détail", () => {
    // The breakdown needs an estimate answered, which only a script can do: the price is drawn alone, as the server would.
    const price = priceOf(MODEL, "standard", { zone: "centre", bedrooms: "t3", surface: "s70", frequency: "biweekly" });
    document.body.innerHTML = renderToString(<PriceCompact model={MODEL} flow="estimate" price={price} locale="fr" taxCredit={undefined} text={flowTextOf(fr, "fr")} />);
    expect(document.body.querySelector("[data-price-cents]")).toHaveAttribute("data-price-cents", "7700");
    const detail = document.body.querySelector("details");
    expect(detail?.querySelector("summary")).toHaveTextContent("Détail");
    expect(detail).toHaveTextContent(fr.priceBase ?? "");
  });

  it("opens on the screen a refusal is about", () => {
    document.body.innerHTML = renderToString(capture({ need: "deep", initialError: leadErrorOf({ lead_error: "phone" }) }));
    expect(shown()).toEqual(["phone"]);
  });
});

describe.each(ENGINES)("LeadCapture's steps, tapped as in %s", engine => {
  const tap = tapIn(engine);
    it("moves on at a tap, the postcode on its screen, then the phone — each move reported", () => {
      const { wrap, events } = recorder();
      render(wrap(capture()));
      tap(radio("job", "deep"));
      expect(shown()).toEqual(["locality"]);
      expect(document.activeElement).toBe(field("zip"));
      expect(progress()).toBe("Étape 2/3");
      // The answered screen is a chip, a tap back to it.
      const chip = screen.getByRole("button", { name: /Votre besoin, Grand ménage Modifier/ });
      fireEvent.change(field("zip"), { target: { value: "75011" } });
      fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
      expect(shown()).toEqual(["phone"]);
      expect(document.activeElement).toBe(field("mobile"));
      expect(screen.getByRole("button", { name: /Code postal, 75011/ })).toBeTruthy();
      fireEvent.click(chip);
      expect(shown()).toEqual(["need"]);
      expect(steps(events)).toEqual(["locality", "phone", "need"]);
      expect(posted()).toMatchObject({ job: "deep", zip: "75011" });
    });

    it("keeps the postcode screen until it is answered, and Enter in it moves on", () => {
      render(capture({ need: "deep" }));
      expect(shown()).toEqual(["locality"]);
      fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
      expect(shown()).toEqual(["locality"]);
      expect(field("zip")).toHaveAttribute("aria-invalid", "true");
      fireEvent.change(field("zip"), { target: { value: "75011" } });
      const enter = fireEvent.keyDown(field("zip"), { key: "Enter" });
      expect(enter).toBe(false);
      expect(shown()).toEqual(["phone"]);
    });

    it("goes back one screen", () => {
      render(capture({ need: "deep" }));
      fireEvent.change(field("zip"), { target: { value: "75011" } });
      fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
      fireEvent.click(screen.getByRole("button", { name: "Retour" }));
      expect(shown()).toEqual(["locality"]);
      expect(field("zip").value).toBe("75011");
    });

    it("does not ask twice: a need the page knows, a commune the place serves alone, a postcode in the query", () => {
      window.history.replaceState(null, "", "/fr?postcode=75011");
      render(capture({ need: "deep" }));
      expect(shown()).toEqual(["phone"]);
      expect(field("zip").value).toBe("75011");
      expect(screen.getByRole("button", { name: /Votre besoin, Grand ménage/ })).toBeTruthy();
      expect(progress()).toBe("Étape 3/3");
      cleanup();
      window.history.replaceState(null, "", "/fr?postcode=<b>");
      render(capture({ place: { ...place, serviceArea: [{ kind: "localities", names: ["Royat"] }] } }));
      tap(radio("job", "deep"));
      expect(shown()).toEqual(["phone"]);
      expect(field("zip").value).toBe("Royat");
    });

    it("asks an estimate one question a screen, prices it on the phone's screen, and posts every answer", () => {
      const { wrap, events } = recorder();
      render(wrap(capture({ need: "standard", localityStep: "with-phone" })));
      expect(shown()).toEqual(["estimate_zone"]);
      tap(radio("estimate_zone", "centre"));
      tap(radio("estimate_bedrooms", "t3"));
      tap(radio("estimate_surface", "s70"));
      tap(radio("estimate_frequency", "biweekly"));
      expect(shown()).toEqual(["phone"]);
      expect(document.activeElement).toBe(field("zip"));
      expect(form().querySelector("[data-price-cents]")).toHaveAttribute("data-price-cents", "7700");
      expect(within(form()).getByRole("button", { name: "Réserver" })).toBeTruthy();
      expect(posted()).toMatchObject({ estimate_zone: "centre", estimate_bedrooms: "t3", estimate_surface: "s70", estimate_frequency: "biweekly", shown_cents: "7700" });
      expect(steps(events)).toEqual(["estimate_bedrooms", "estimate_surface", "estimate_frequency", "phone"]);
      expect(progress()).toBe("Étape 6/6");
    });

    it("an arrow key chooses without moving on", () => {
      render(capture({ need: "standard" }));
      fireEvent.keyDown(radio("estimate_zone", "centre"), { key: "ArrowDown" });
      fireEvent.click(radio("estimate_zone", "proche"));
      expect(radio("estimate_zone", "proche")).toBeChecked();
      expect(shown()).toEqual(["estimate_zone"]);
      fireEvent.keyDown(radio("estimate_zone", "proche"), { key: "Enter" });
      expect(shown()).toEqual(["estimate_bedrooms"]);
    });

    it("takes \"I don't know\" as a quote: the questions after it go, and so does the price", () => {
      render(capture({ need: "standard", questions: { bedrooms: { unknown: true } } }));
      tap(radio("estimate_zone", "centre"));
      tap(radio("estimate_bedrooms", ESTIMATE_UNKNOWN));
      expect(shown()).toEqual(["locality"]);
      expect(form().querySelector("input[name=estimate_surface]")).toBeNull();
      expect(screen.getByRole("button", { name: /Chambres, Je ne sais pas/ })).toBeTruthy();
      expect(posted()).toMatchObject({ estimate_bedrooms: ESTIMATE_UNKNOWN });
      expect(posted()).not.toHaveProperty("shown_cents");
      // On the phone's screen, still to come.
      expect(form().querySelector("button[type=submit]")).toHaveTextContent("Recevoir le prix");
      expect(form().querySelector("[data-price-cents]")).toBeNull();
    });

    it("asks an intro question first, posted as the brand's field; a call back is the phone and its consent", () => {
      const intro = {
        label: "C'est urgent ?",
        field: "urgency",
        options: [
          { value: "today", label: "Urgent — aujourd'hui", channel: "callback" as const },
          { value: "week", label: "Cette semaine" },
        ],
      };
      render(capture({ intro, needDisplay: "cards" }));
      expect(shown()).toEqual(["intro"]);
      // Which branch, and how long, is the intro's to say.
      expect(progress()).toBe("Étape 1");
      tap(radio("urgency", "week"));
      expect(shown()).toEqual(["need"]);
      expect(form().querySelector("[data-lead-step=need] svg[data-icon=standard]")).toBeTruthy();
      expect(posted()).toMatchObject({ urgency: "week" });
      expect(posted()).not.toHaveProperty("channel");
      fireEvent.click(screen.getByRole("button", { name: /C'est urgent \?, Cette semaine/ }));
      tap(radio("urgency", "today"));
      expect(shown()).toEqual(["phone"]);
      expect(progress()).toBe("Étape 2/2");
      expect(posted()).toMatchObject({ urgency: "today", channel: "callback" });
      const consent = form().querySelector("input[type=checkbox][name=consent]");
      expect(consent).toBeRequired();
      expect(within(form()).getByRole("button", { name: fr.callbackSubmit })).toBeTruthy();
      // No second call back below: the form is it.
      expect(document.getElementById("quote-callback")).toBeNull();
    });
});

describe.each(ENGINES)("LeadCapture's steps, questions sharing a screen, tapped as in %s", engine => {
  const tap = tapIn(engine);
    const questions = { bedrooms: { step: 1, next: "Voir les prix" }, surface: { step: 1, shortLabels: { s40: "< 40" }, unknown: true, unknownSpan: 2 as const } };

    it("moves on once every question of the screen is answered; until then its button says what is missing", () => {
      render(capture({ need: "standard", questions }));
      tap(radio("estimate_zone", "centre"));
      expect(shown()).toEqual(["estimate_bedrooms"]);
      tap(radio("estimate_bedrooms", "t3"));
      expect(shown()).toEqual(["estimate_bedrooms"]);
      expect(document.activeElement).toBe(radio("estimate_surface", "s40"));
      const next = screen.getByRole("button", { name: "Voir les prix" });
      expect(next).toBeTruthy();
      tap(radio("estimate_surface", "s70"));
      expect(shown()).toEqual(["estimate_frequency"]);
      expect(screen.getByRole("button", { name: /Chambres · Surface, 2 chambres · 40 à 70 m²/ })).toBeTruthy();
    });

    it("draws a short label on a phone, names the radio in full, and lets \"I don't know\" take two columns", () => {
      render(capture({ need: "standard", questions, classNames: { estimateUnknown: "brand-unknown" } }));
      const s40 = radio("estimate_surface", "s40");
      expect(s40).toHaveAttribute("aria-label", "Moins de 40 m²");
      expect(s40.nextElementSibling?.querySelector(".sm\\:hidden")).toHaveTextContent("< 40");
      const unknown = radio("estimate_surface", ESTIMATE_UNKNOWN);
      expect(unknown.closest("label")?.className).toContain("col-span-2");
      expect(unknown.nextElementSibling?.className).toContain("brand-unknown");
    });
});

describe("LeadCapture's compact pieces", () => {
  const answerAll = (frequency = "biweekly") => {
    for (const [input, option] of [["zone", "centre"], ["bedrooms", "t3"], ["surface", "s70"], ["frequency", frequency]] as const) fireEvent.click(radio(`estimate_${input}`, option));
  };

  it("prices each card of a question with the total it would make, once the others are answered, with its badge", () => {
    render(capture({ layout: "single", need: "standard", questions: { frequency: { display: "cards", badges: { biweekly: "Le plus choisi" } } } }));
    const card = (option: string) => radio("estimate_frequency", option).nextElementSibling;
    expect(card("weekly")).not.toHaveTextContent("€");
    expect(card("biweekly")).toHaveTextContent("Le plus choisi");
    answerAll();
    expect(card("weekly")).toHaveTextContent(/72\s€/);
    expect(card("biweekly")).toHaveTextContent(/77\s€/);
    expect(card("once")).toHaveTextContent(/85\s€/);
    expect(card("weekly")).not.toHaveTextContent("Le plus choisi");
  });

  it("shows the price on one line, what is left after the tax credit, and the breakdown behind Détail", () => {
    render(capture({ layout: "single", need: "standard", price: "compact", taxCredit: 0.5 }));
    expect(form()).toHaveTextContent(fr.pricePending ?? "");
    answerAll();
    const line = form().querySelector("[data-price-cents]");
    expect(line).toHaveAttribute("data-price-cents", "7700");
    expect(line).toHaveTextContent(/Votre prix : 77\s€/);
    expect(form().querySelector("[data-credit-cents]")).toHaveAttribute("data-credit-cents", "3850");
    expect(form()).toHaveTextContent(/38,50\s€ après crédit d’impôt/);
    // Scripted, the breakdown is the kit's popover, portalled out of the form.
    expect(form().querySelector("details")).toBeNull();
    fireEvent.click(within(form()).getByRole("button", { name: "Détail" }));
    expect(screen.getByRole("dialog", { name: "Détail" })).toHaveTextContent(fr.priceBase ?? "");
    expect(form().querySelector("[class*=bg-card]")).toBeNull();
    cleanup();
    render(capture({ layout: "single", need: "standard", price: "compact" }));
    answerAll();
    expect(form().querySelector("[data-credit-cents]")).toBeNull();
  });

  it("asks the need with cards on one screen too, each with the brand's icon, required", () => {
    render(capture({ layout: "single", needDisplay: "cards" }));
    expect(form().querySelector("select, [role=combobox]")).toBeNull();
    expect(radio("job", "standard")).toBeRequired();
    expect(radio("job", "standard").nextElementSibling?.querySelector("svg[data-icon=standard]")).toBeTruthy();
    expect(radio("job", "deep").nextElementSibling?.querySelector("svg")).toBeNull();
    expect(posted()).not.toHaveProperty("job");
  });

  it("puts the brand's line right under the phone, and drops an empty privacy line", () => {
    render(capture({ layout: "single", need: "deep", afterPhone: <p data-testid="after">Votre numéro reste entre nous.</p>, text: { ...fr, privacy: "" } }));
    const phoneField = field("mobile").closest("[data-slot=field]") ?? field("mobile").parentElement;
    expect(phoneField?.nextElementSibling).toBe(screen.getByTestId("after"));
    expect(form()).not.toHaveTextContent(LEAD_CAPTURE_TEXT.fr.privacy);
  });

  it("draws the other channels as one row of buttons with the brand's icons, named as a group", () => {
    render(capture({ layout: "single", channelsDisplay: "row", channelIcons: { whatsapp: <svg data-icon="wa" />, callback: <svg data-icon="cb" /> } }));
    const row = screen.getByRole("group", { name: fr.otherChannels });
    expect(row.className).toContain("flex-row");
    expect(within(row).getByText("WhatsApp").closest("a")?.querySelector("svg[data-icon=wa]")).toBeTruthy();
    expect(row.querySelector("summary svg[data-icon=cb]")).toBeTruthy();
    expect(screen.queryByText(fr.otherChannels, { selector: "p" })).toBeNull();
  });
});

describe.each(ENGINES)("LeadCapture's focusNext on one screen, tapped as in %s", engine => {
  const tap = tapIn(engine);
    it("moves from a tapped answer to the next question, and from Enter to the next empty field", () => {
      render(capture({ layout: "single", need: "standard", focusNext: true }));
      tap(radio("estimate_zone", "centre"));
      expect(document.activeElement).toBe(radio("estimate_bedrooms", "studio"));
      for (const [input, option] of [["bedrooms", "t3"], ["surface", "s70"], ["frequency", "once"]] as const) tap(radio(`estimate_${input}`, option));
      expect(document.activeElement).toBe(field("zip"));
      fireEvent.change(field("zip"), { target: { value: "75011" } });
      const enter = fireEvent.keyDown(field("zip"), { key: "Enter" });
      expect(enter).toBe(false);
      expect(document.activeElement).toBe(field("mobile"));
      // The last field: Enter is the form's, which submits.
      fireEvent.change(field("mobile"), { target: { value: "0612345678" } });
      expect(fireEvent.keyDown(field("mobile"), { key: "Enter" })).toBe(true);
    });

    it("is off by default: Enter and taps are as they were", () => {
      render(capture({ layout: "single", need: "standard" }));
      act(() => radio("estimate_zone", "centre").focus());
      tap(radio("estimate_zone", "centre"));
      expect(document.activeElement).toBe(radio("estimate_zone", "centre"));
      expect(fireEvent.keyDown(field("zip"), { key: "Enter" })).toBe(true);
    });

    it("prefills the postcode from the query on one screen too", () => {
      window.history.replaceState(null, "", "/fr?postcode=69001");
      render(capture({ layout: "single" }));
      expect(field("zip").value).toBe("69001");
    });
});
