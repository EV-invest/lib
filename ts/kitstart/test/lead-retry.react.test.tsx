import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEAD_CAPTURE_TEXT, parsePricingModel, type OpeningHours, type Place } from "../src/index";
import { LeadCapture, type LeadCaptureProps } from "../src/react/index";
import { SUBMIT_TIMEOUT_MS } from "../src/react/use-lead-submit";
import { serviceAreaPlace } from "../src/testing/index";

// A retry after a hung server must carry the id of the post it repeats: that
// post may have been stored, and only the id lets the server answer the
// retry with its row instead of storing a second lead.

const MODEL = parsePricingModel(JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/pricing/valid/cleaning.json"), "utf8")));
const WEEKDAYS: readonly OpeningHours[] = [{ days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "19:00" }];
// Paris is UTC+2 in October 2026.
const MONDAY_10H = new Date("2026-10-05T08:00:00Z").getTime();
const MONDAY_18H59 = new Date("2026-10-05T16:59:50Z").getTime();
const MOBILE = "+33 6 12 34 56 78";
const NEEDS = [
  { value: "standard", label: "Ménage courant" },
  { value: "windows", label: "Vitres" },
  { value: "deep", label: "Grand ménage" },
];
const place: Place<"fr" | "en"> = serviceAreaPlace(["fr", "en"], { hours: WEEKDAYS });

/** The card as a cleaning brand draws it: priced flows, a name, photos for the deep clean, an in-card done. */
function capture(over: Partial<LeadCaptureProps> = {}): ReactElement {
  return (
    <LeadCapture
      place={place}
      contact={{ phone: MOBILE, whatsapp: MOBILE }}
      locale="fr"
      renderedAt={MONDAY_10H}
      wire={{ subject: "job", locality: "zip", mobile: "mobile" }}
      needs={NEEDS}
      flows={{ standard: "estimate", windows: "fixed", deep: "quote" }}
      pricing={MODEL}
      photos={["deep"]}
      name={{ field: "name" }}
      text={LEAD_CAPTURE_TEXT.fr}
      done={sent => <p>C’est noté, {sent.name} !</p>}
      {...over}
    />
  );
}

const form = (id = "quote-form") => {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLFormElement)) throw new Error(`no form #${id}`);
  return el;
};
const input = (f: HTMLFormElement, name: string) => {
  const el = f.querySelector(`input[name=${name}]`);
  if (!(el instanceof HTMLInputElement)) throw new Error(`no input ${name} in #${f.id}`);
  return el;
};
const type = (f: HTMLFormElement, name: string, value: string) => fireEvent.change(input(f, name), { target: { value } });
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

/** The first post hangs until the page gives up on it; every later one is taken. */
function hangOnce() {
  const fetch = vi.fn((_url: string, init: RequestInit): Promise<Response> => {
    if (fetch.mock.calls.length === 1) return new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    return Promise.resolve(new Response(JSON.stringify({ ok: true, location: "/fr/thanks", lead: "lead-1-0a1b2c3d" }), { status: 200, headers: { "content-type": "application/json" } }));
  });
  vi.stubGlobal("fetch", fetch);
  const sid = (n: number) => Object.fromEntries((fetch.mock.calls[n] as unknown as [string, RequestInit])[1].body as URLSearchParams)["submission_id"];
  return { fetch, sid };
}

/** Past the timeout, and past a minute's tick of the opening hours' clock. */
async function giveUp() {
  await act(async () => {
    vi.advanceTimersByTime(SUBMIT_TIMEOUT_MS);
    await flush();
  });
}

async function retry(f: HTMLFormElement) {
  await act(async () => {
    fireEvent.click(within(f).getByRole("button", { name: LEAD_CAPTURE_TEXT.fr.retry }));
    await flush();
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"], now: MONDAY_10H });
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a retry after the server hung", () => {
  // vifnet tests/e2e/lead-robust.spec.ts, "the server hangs…", step by step.
  it("posts the same submission id as the post it repeats, for a need picked from the list", async () => {
    const { fetch, sid } = hangOnce();
    render(capture());
    fireEvent.click(screen.getByRole("combobox", { name: LEAD_CAPTURE_TEXT.fr.needLabel }));
    fireEvent.click(screen.getByRole("option", { name: "Grand ménage" }));
    const f = form();
    type(f, "zip", "75015");
    type(f, "mobile", "06 12 34 56 78");
    type(f, "name", "Amanda Reyes");
    await act(async () => {
      fireEvent.click(within(f).getByRole("button", { name: LEAD_CAPTURE_TEXT.fr.submit }));
      await flush();
    });
    expect(within(f).getByRole("button", { name: LEAD_CAPTURE_TEXT.fr.sending })).toBeDisabled();
    await giveUp();
    expect(within(f).getByRole("alert")).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.timeoutError);
    // The opening hours' clock ticks while the visitor reads the message.
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await flush();
    });
    await retry(f);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sid(0)).toMatch(/^[0-9a-f-]{36}$/);
    expect(sid(1)).toBe(sid(0));
    expect(screen.getByRole("status")).toHaveTextContent("C’est noté, Amanda Reyes !");
  });

  it("posts the same id for a priced need, its shown price posted again unchanged", async () => {
    const { fetch, sid } = hangOnce();
    render(capture({ need: "windows" }));
    const f = form();
    type(f, "zip", "75015");
    type(f, "mobile", "06 12 34 56 78");
    await act(async () => {
      fireEvent.submit(f);
      await flush();
    });
    await giveUp();
    await retry(f);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sid(1)).toBe(sid(0));
  });

  // The callback moves to the head of the card when the place closes, and a
  // moved form is drawn anew: the retry went to the old one, off the page —
  // nothing sent, the number gone, and the visitor's resend a second lead.
  it("posts the callback's same id when the place closes during the wait", async () => {
    vi.setSystemTime(MONDAY_18H59);
    const { fetch, sid } = hangOnce();
    render(capture({ renderedAt: MONDAY_18H59 }));
    const cb = () => form("quote-callback-form");
    const drawn = cb();
    type(cb(), "mobile", "06 12 34 56 78");
    fireEvent.click(cb().querySelector("input[name=consent]") as HTMLInputElement);
    await act(async () => {
      fireEvent.submit(cb());
      await flush();
    });
    await giveUp();
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await flush();
    });
    expect(cb()).toBe(drawn);
    expect(input(cb(), "mobile").value).toBe("06 12 34 56 78");
    await retry(cb());
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sid(1)).toBe(sid(0));
  });

  it("leaves the channels to the clock once nothing is waiting", async () => {
    vi.setSystemTime(MONDAY_18H59);
    render(capture({ renderedAt: MONDAY_18H59 }));
    const first = () => document.querySelector("#quote > details, #quote > form");
    expect(first()?.id).toBe("quote-form");
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await flush();
    });
    expect(first()?.id).toBe("quote-callback");
  });
});
