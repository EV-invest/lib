import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEAD_CAPTURE_TEXT, parsePricingModel, type OpeningHours } from "../src/index";
import type { LeadCaptureProps } from "../src/react/index";
import { serviceAreaPlace } from "../src/testing/index";
import { freshKit, heldChunk, hydrate, landAll, mount, serverHtml, type FreshKit } from "./support/cold";

// LeadCapture on a page whose chunks are still on their way: the server's
// markup kept while hydrating waits, the card live once they land, and a
// part first drawn later appearing when its own chunk does.

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
const PROPS: LeadCaptureProps = {
  place: serviceAreaPlace(["fr", "en"], { hours: WEEKDAYS }),
  contact: { phone: MOBILE, whatsapp: MOBILE },
  locale: "fr",
  renderedAt: MONDAY_10H,
  wire: { subject: "job", locality: "zip", mobile: "mobile" },
  needs: NEEDS,
  flows: FLOWS,
  pricing: MODEL,
  text: LEAD_CAPTURE_TEXT.fr,
};

const card = (over: Partial<LeadCaptureProps>) => (k: FreshKit) => k.React.createElement(k.kit.LeadCapture, { ...PROPS, ...over });

const form = (container: HTMLElement) => {
  const el = container.querySelector("#quote-form");
  if (!(el instanceof HTMLFormElement)) throw new Error("no form");
  return el;
};
/** The screen on: the one step not hidden. */
const shown = (container: HTMLElement) =>
  [...form(container).querySelectorAll<HTMLElement>("[data-lead-step]")].filter(s => !s.hasAttribute("data-lead-off") && s.style.display !== "none").map(s => s.dataset["leadStep"]);
const radio = (container: HTMLElement, name: string, value: string) => {
  const el = form(container).querySelector(`input[type=radio][name="${name}"][value="${value}"]`);
  if (!(el instanceof HTMLInputElement)) throw new Error(`no radio ${name}=${value}`);
  return el;
};
/** A pointer's tap on a tile's radio, as Chromium delivers it (see lead-capture-steps). */
const tap = (k: FreshKit, el: Element) =>
  k.React.act(async () => {
    fireEvent.pointerDown(el);
    fireEvent.click(el, { detail: 1 });
  });
const questions = (container: HTMLElement) => [...new Set([...form(container).querySelectorAll<HTMLInputElement>("input[type=radio][name^=estimate_]")].map(i => i.name))];

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("LeadCapture hydrating before its chunks are here", () => {
  it("keeps the server's steps markup while the steps chunk is on its way, then moves on at a tap once it lands", async () => {
    const html = await serverHtml(card({ layout: "steps" }));
    const steps = heldChunk();
    const k = await freshKit({ LeadCaptureSteps: steps });
    const errors = vi.spyOn(console, "error");
    const page = await hydrate(k, html, card({ layout: "steps" })(k));
    // As the browser parsed it: `innerHTML` read back, not the server's string.
    const parsed = document.createElement("div");
    parsed.innerHTML = html;

    expect(steps.asked).toBe(true);
    expect(page.container.innerHTML).toBe(parsed.innerHTML);

    await landAll(k);
    expect(page.recoverable).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    expect(shown(page.container)).toEqual(["need"]);
    await tap(k, radio(page.container, "job", "deep"));
    expect(shown(page.container)).toEqual(["locality"]);
  });

  it("asks for every chunk the steps card may draw at once, not one behind another", async () => {
    const html = await serverHtml(card({ layout: "steps" }));
    const k = await freshKit({ LeadCaptureSteps: heldChunk() });
    await hydrate(k, html, card({ layout: "steps" })(k));
    // The steps are still on their way, and nothing has drawn an estimate or a price yet.
    expect({ estimate: k.chunks.LeadCaptureEstimate.asked, price: k.chunks.LeadCapturePrice.asked }).toEqual({ estimate: true, price: true });
  });

  it("keeps the server's estimate questions while their chunk is on its way, then prices the answers once it lands", async () => {
    const over = { needDisplay: "tiles", need: "standard" } as const;
    const html = await serverHtml(card(over));
    const estimate = heldChunk();
    const k = await freshKit({ LeadCaptureEstimate: estimate });
    const errors = vi.spyOn(console, "error");
    const page = await hydrate(k, html, card(over)(k));
    const parsed = document.createElement("div");
    parsed.innerHTML = html;

    expect(estimate.asked).toBe(true);
    expect(page.container.innerHTML).toBe(parsed.innerHTML);

    await landAll(k);
    expect(page.recoverable).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    await tap(k, radio(page.container, "estimate_zone", "proche"));
    await tap(k, radio(page.container, "estimate_bedrooms", "t3"));
    await tap(k, radio(page.container, "estimate_surface", "s70"));
    await tap(k, radio(page.container, "estimate_frequency", "biweekly"));
    expect(form(page.container).querySelector("[data-price-cents]")).toHaveAttribute("data-price-cents");
  });
});

describe("a LeadCapture part first drawn after hydration", () => {
  it("draws the estimate's questions once their chunk lands, the rest of the card kept meanwhile", async () => {
    const over = { needDisplay: "tiles" } as const;
    const html = await serverHtml(card(over));
    const estimate = heldChunk();
    const k = await freshKit({ LeadCaptureEstimate: estimate });
    const page = await hydrate(k, html, card(over)(k));
    // The tiles' chunk is open: the need is live while the estimate's is held.
    await k.React.act(async () => {
      await import("../src/react/LeadCaptureTiles");
    });
    expect(questions(page.container)).toEqual([]);

    await tap(k, radio(page.container, "job", "standard"));
    expect(questions(page.container)).toEqual([]);
    expect(form(page.container).querySelector("input[name=mobile]")).toBeInstanceOf(HTMLInputElement);
    expect(radio(page.container, "job", "standard").checked).toBe(true);

    await landAll(k);
    expect(questions(page.container)).toEqual(["estimate_zone", "estimate_bedrooms", "estimate_surface", "estimate_frequency"]);
  });
});

describe("loadLazyParts", () => {
  it("resolves only once every part's chunk is here, and a card then renders in one synchronous pass", async () => {
    const steps = heldChunk();
    const k = await freshKit({ LeadCaptureSteps: steps });
    let settled = false;
    const loading = k.kit.loadLazyParts().then(() => (settled = true));
    await vi.waitFor(() => expect(steps.asked).toBe(true));
    // Every chunk but the held one lands.
    await Promise.all([import("../src/react/LeadCaptureEstimate"), import("../src/react/LeadCapturePrice"), import("../src/react/FormSelectKit")]);
    expect(settled).toBe(false);

    steps.release();
    await loading;
    const html = k.server.renderToString(card({ layout: "steps" })(k));
    expect(html).toContain('data-lead-step="need"');
  });
});

describe("LeadCapture rendered on a page with no server markup", () => {
  it("draws nothing for a part until its chunk lands, then the part", async () => {
    const steps = heldChunk();
    const k = await freshKit({ LeadCaptureSteps: steps });
    const page = await mount(k, card({ layout: "steps" })(k));
    expect(page.container.querySelector("[data-lead-step]")).toBeNull();

    await landAll(k);
    expect(shown(page.container)).toEqual(["need"]);
  });
});
