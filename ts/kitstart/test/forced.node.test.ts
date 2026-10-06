import { afterEach, describe, expect, it, vi } from "vitest";
import { abSwitcherVisible } from "../src/core/ab-gate";
import { analyticsSink, qaVisit } from "../src/index";
import { openSqliteLeadStore } from "../src/server/index";
import { quoteRoute } from "../src/next/index";
import { fixtureSite } from "./support/fixtures";

const site = fixtureSite("aquafix");
const NOW = 1_800_000_000_000;

type Beacon = { event: string; properties: Record<string, unknown> };

/** Stubs the beacon; the returned function reads what was sent so far. */
function listen(): () => Beacon[] {
  const beacon = vi.fn<(url: string, body: string) => boolean>(() => true);
  vi.stubGlobal("navigator", { sendBeacon: beacon });
  return () => beacon.mock.calls.map(([, body]) => JSON.parse(body) as Beacon);
}

afterEach(() => vi.unstubAllGlobals());

const route = (qaCookie?: string) =>
  quoteRoute(site, {
    env: () => ({ leadsDb: { kind: "sqlite", path: ":memory:" }, posthogKey: "phc_test", posthogHost: "https://eu.i.posthog.com", trustedProxy: null }),
    notifier: () => ({ notify: async () => undefined }),
    unavailable: () => ({ title: "", heading: "", body: "", callLabel: "" }),
    store: () => openSqliteLeadStore(":memory:"),
    defer: task => void task(),
    now: () => NOW,
    log: { warn: vi.fn(), error: vi.fn() },
    ...(qaCookie ? { qaCookie } : {}),
  });

const post = (cookie: string | null, mobile = "0612345678") => {
  const body = new URLSearchParams({ location: "royat", locale: "fr", form_id: "quote", t: String(NOW - 10_000), website: "", job: "other", zip: "63130", mobile });
  const headers: Record<string, string> = { host: "royat.aquafix.top", "content-type": "application/x-www-form-urlencoded" };
  if (cookie !== null) headers["cookie"] = cookie;
  return new Request("https://aquafix.top/quote", { method: "POST", body, headers });
};

describe("quoteRoute on a test visit", () => {
  it("says forced: true on lead_form_submit when the post carries the QA cookie", async () => {
    const sent = listen();
    await route("ab__qa")(post("ab_lead_form=b; ab__qa=1"));
    const beacons = sent();
    expect(beacons.map(b => b.event)).toEqual(["lead_form_submit"]);
    expect(beacons[0]?.properties).toMatchObject({ form_id: "quote", location_id: "royat", forced: true });
  });

  it("says forced: true on lead_form_reject too", async () => {
    const sent = listen();
    await route("ab__qa")(post("ab__qa=1", "06 12"));
    const beacons = sent();
    expect(beacons.map(b => b.event)).toEqual(["lead_form_reject"]);
    expect(beacons[0]?.properties).toMatchObject({ field: "phone", forced: true });
  });

  it("adds no forced key without the cookie, with it empty, for a look-alike, or without qaCookie", async () => {
    const cases: [string | undefined, string | null][] = [
      ["ab__qa", null],
      ["ab__qa", "ab__qa="],
      ["ab__qa", "ab__qa_old=1; xab__qa=1"],
      [undefined, "ab__qa=1"],
    ];
    for (const [name, cookie] of cases) {
      const sent = listen();
      await route(name)(post(cookie));
      const beacons = sent();
      expect(beacons.map(b => b.event), `${name} / ${cookie}`).toEqual(["lead_form_submit"]);
      expect(beacons[0]?.properties, `${name} / ${cookie}`).not.toHaveProperty("forced");
    }
  });
});

describe("the QA-visit rule", () => {
  const cookies = ["", "ab__qa=1", "ab__qa=", "ab__qa= ", " ab__qa = x ", "a=1; ab__qa=yes", "ab__qa_old=1", "xab__qa=1", "ab__qa", "=1", "a=1;ab__qa=0"];

  it("is the same in the sink's qaVisit and in AbSwitcher's own copy", () => {
    for (const c of cookies) expect(qaVisit(c, "ab__qa"), c).toBe(abSwitcherVisible(c, "ab__qa", "production"));
  });

  it("leaves a sink without qaCookie as it was: no forced key, whatever the cookies say", () => {
    const sent = listen();
    const target = { key: "phc_test", host: "https://eu.i.posthog.com", brandId: "aquafix" };
    analyticsSink(target, "royat", "id-1", undefined, "ab__qa=1").capture("lead_form_view", { form_id: "quote" });
    analyticsSink(target, "royat", "id-1", "ab__qa", "ab__qa=1").capture("lead_form_view", { form_id: "quote" });
    const [plain, marked] = sent();
    expect(plain?.properties).not.toHaveProperty("forced");
    expect(marked?.properties).toMatchObject({ form_id: "quote", forced: true });
  });
});
