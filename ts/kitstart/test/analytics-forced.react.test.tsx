import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTS } from "../src/index";
import { AnalyticsBoundary } from "../src/react/index";
import { useBooking } from "../src/react/use-booking";
import { useLeadEvents } from "../src/react/use-lead-events";

vi.mock("next/navigation.js", () => ({ usePathname: () => "/fr/paris" }));

type Beacon = { event: string; properties: Record<string, unknown> };
let beacons: Beacon[];
// jsdom cannot follow a `tel:` link; the tracker has read the click by then.
const stay = (e: MouseEvent) => e.preventDefault();
const clearCookies = () => {
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
};

beforeEach(() => {
  beacons = [];
  clearCookies();
  document.addEventListener("click", stay);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
  vi.stubGlobal("navigator", { ...navigator, sendBeacon: (_url: string, body: string) => (beacons.push(JSON.parse(body) as Beacon), true) });
});
afterEach(() => {
  document.removeEventListener("click", stay);
  vi.unstubAllGlobals();
  clearCookies();
});

/** The page view, a `data-intent` click and a phone link's click, through the real sink. */
function events(qaCookie?: string): Beacon[] {
  render(
    <AnalyticsBoundary target={{ key: "phc_test", host: "https://eu.i.posthog.com", brandId: "aquafix" }} placeSlug="paris" {...(qaCookie ? { qaCookie } : {})}>
      <button type="button" data-intent="booking">Book</button>
      <a href="tel:+33612345678">Call</a>
    </AnalyticsBoundary>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Book" }));
  fireEvent.click(screen.getByRole("link", { name: "Call" }));
  return beacons.filter(b => b.event === EVENTS.pageView || b.event === EVENTS.intent);
}

describe("a test visit's events", () => {
  it("say forced: true on the page view and on both intents, when the QA cookie is set", () => {
    document.cookie = "ab__qa=1; path=/";
    const sent = events("ab__qa");
    expect(sent.map(b => [b.event, b.properties["channel"] ?? null])).toEqual([
      [EVENTS.pageView, null],
      [EVENTS.intent, "booking"],
      [EVENTS.intent, "phone"],
    ]);
    for (const b of sent) expect(b.properties["forced"], b.event).toBe(true);
  });

  it("carry no forced key without the cookie, with it empty, or for a look-alike name", () => {
    document.cookie = "ab__qa=; path=/";
    document.cookie = "ab__qa_old=1; path=/";
    document.cookie = "ab_lead_form=b; path=/";
    const sent = events("ab__qa");
    expect(sent).toHaveLength(3);
    for (const b of sent) expect(b.properties, b.event).not.toHaveProperty("forced");
  });

  it("carry no forced key from a boundary without qaCookie, even on a test visit", () => {
    document.cookie = "ab__qa=1; path=/";
    const sent = events();
    expect(sent).toHaveLength(3);
    for (const b of sent) expect(b.properties, b.event).not.toHaveProperty("forced");
  });
});

/** The lead form's funnel and its booking, through the hooks `LeadCapture` uses. */
function Funnel() {
  const root = useRef<HTMLFormElement>(null);
  const events = useLeadEvents(root, { formId: "quote", layout: "steps" });
  const booking = useBooking("cal_com", "sub-1", "quote");
  return (
    <form ref={root}>
      <input aria-label="Phone" />
      <button type="button" onClick={() => events.step("phone")}>Step</button>
      <button type="button" onClick={() => events.fieldError("phone")}>Hint</button>
      <button type="button" onClick={() => events.submitError("network", "form")}>Lost</button>
      <button type="button" onClick={() => events.estimateShown("leak", 12_000)}>Estimate</button>
      <button type="button" onClick={() => void booking.requested({ lead_ref: "L-1", provider: "cal_com" })}>Open booking</button>
      <button type="button" onClick={() => booking.booked()}>Booked</button>
    </form>
  );
}

const FUNNEL = [EVENTS.formView, EVENTS.formStart, EVENTS.formStep, EVENTS.fieldError, EVENTS.submitError, EVENTS.estimateShown, EVENTS.bookingOpen, EVENTS.bookingDone];

async function funnel(qaCookie?: string): Promise<Beacon[]> {
  vi.stubGlobal("fetch", async () => new Response(null, { status: 204 }));
  render(
    <AnalyticsBoundary target={{ key: "phc_test", host: "https://eu.i.posthog.com", brandId: "aquafix" }} placeSlug="paris" {...(qaCookie ? { qaCookie } : {})}>
      <Funnel />
    </AnalyticsBoundary>,
  );
  fireEvent.focusIn(screen.getByRole("textbox", { name: "Phone" }));
  for (const name of ["Step", "Hint", "Lost", "Estimate", "Open booking", "Booked"]) {
    await act(async () => fireEvent.click(screen.getByRole("button", { name })));
  }
  return beacons.filter(b => FUNNEL.some(e => e === b.event));
}

describe("a test visit's lead-form funnel, marked by the sink", () => {
  it("says forced: true on every funnel and booking event with the QA cookie", async () => {
    document.cookie = "ab__qa=1; path=/";
    const sent = await funnel("ab__qa");
    expect(sent.map(b => b.event)).toEqual(FUNNEL);
    for (const b of sent) expect(b.properties["forced"], b.event).toBe(true);
  });

  it("carries no forced key with the cookie empty", async () => {
    document.cookie = "ab__qa=; path=/";
    const empty = await funnel("ab__qa");
    expect(empty.map(b => b.event)).toEqual(FUNNEL);
    for (const b of empty) expect(b.properties, b.event).not.toHaveProperty("forced");
  });

  it("reads the cookie at each event, not when the sink is built", async () => {
    const sent = await funnel("ab__qa");
    expect(sent[0]?.properties).not.toHaveProperty("forced");
    document.cookie = "ab__qa=1; path=/";
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Booked" })));
    expect(beacons.at(-1)).toMatchObject({ event: EVENTS.bookingDone, properties: { forced: true } });
  });

  it("carries no forced key from a boundary without qaCookie, even on a test visit", async () => {
    document.cookie = "ab__qa=1; path=/";
    const sent = await funnel();
    expect(sent).toHaveLength(FUNNEL.length);
    for (const b of sent) expect(b.properties, b.event).not.toHaveProperty("forced");
  });
});
