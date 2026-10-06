import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTS } from "../src/index";
import { AnalyticsBoundary } from "../src/react/index";

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
