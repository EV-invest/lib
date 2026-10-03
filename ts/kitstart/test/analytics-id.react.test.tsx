import { act, fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_ID, LEAD_CAPTURE_TEXT } from "../src/index";
import { AnalyticsIdContext } from "../src/react/analytics-context";
import { AnalyticsBoundary, LeadCapture } from "../src/react/index";
import { navigation } from "../src/react/use-lead-submit";
import { serviceAreaPlace } from "../src/testing/index";

vi.mock("next/navigation.js", () => ({ usePathname: () => "/fr/paris" }));

const MOBILE = "+33 6 12 34 56 78";
const place = serviceAreaPlace(["fr", "en"]);

const capture = (): ReactElement => (
  <LeadCapture
    place={place}
    contact={{ phone: MOBILE, whatsapp: null }}
    locale="fr"
    renderedAt={0}
    wire={{ subject: "job", locality: "zip", mobile: "mobile" }}
    needs={[{ value: "leak", label: "Fuite" }]}
    text={LEAD_CAPTURE_TEXT.fr}
  />
);

/** Fills and submits the quote form; answers what `fetch` posted. */
async function send(): Promise<Record<string, string>> {
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ ok: true, location: "/fr/paris/thanks" }));
  vi.stubGlobal("fetch", fetch);
  const form = document.getElementById("quote-form");
  if (!(form instanceof HTMLFormElement)) throw new Error("no form");
  for (const input of form.querySelectorAll<HTMLInputElement>("input[name=mobile], input[name=zip]")) fireEvent.change(input, { target: { value: input.name === "zip" ? "75011" : "06 12 34 56 78" } });
  await act(async () => {
    fireEvent.submit(form);
    await Promise.resolve();
  });
  const init = fetch.mock.calls[0]?.[1];
  return Object.fromEntries(init?.body as URLSearchParams);
}

beforeEach(() => {
  vi.spyOn(navigation, "assign").mockImplementation(() => undefined);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the lead's analytics id", () => {
  it("is posted with the lead when the page has one", async () => {
    render(<AnalyticsIdContext.Provider value="0192f0a4-7b3c">{capture()}</AnalyticsIdContext.Provider>);
    expect(await send()).toMatchObject({ analytics_id: "0192f0a4-7b3c" });
  });

  it("is not posted without one, and is never a field of the form", async () => {
    render(capture());
    expect(await send()).not.toHaveProperty("analytics_id");
    expect(document.querySelector("input[name=analytics_id]")).toBeNull();
  });

  it("is the distinct_id the boundary's beacons carry", async () => {
    const beacons: string[] = [];
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: (_url: string, body: string) => (beacons.push(body), true) });
    render(
      <AnalyticsBoundary target={{ key: "phc_test", host: "https://eu.i.posthog.com", brandId: "aquafix" }} placeSlug="paris">
        {capture()}
      </AnalyticsBoundary>,
    );
    const posted = await send();
    const pageView = beacons.map(b => JSON.parse(b) as { event: string; distinct_id: string }).find(b => b.event === "location_page_view");
    expect(pageView).toBeDefined();
    expect(posted["analytics_id"]).toBe(pageView?.distinct_id);
    expect(posted["analytics_id"]).toMatch(ANALYTICS_ID);
  });

  it("is not posted from a boundary with no key: no event names it", async () => {
    render(
      <AnalyticsBoundary target={{ key: null, host: "https://eu.i.posthog.com", brandId: "aquafix" }} placeSlug="paris">
        {capture()}
      </AnalyticsBoundary>,
    );
    expect(await send()).not.toHaveProperty("analytics_id");
  });
});
