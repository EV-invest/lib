import type { AnalyticsSink } from "@evinvest/analytics";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flowTextOf, LEAD_CAPTURE_TEXT, type OpenBookingConfig } from "../src/index";
import { LeadBooking, type BookingAdapters, type LeadSent } from "../src/react/index";
import { AnalyticsSinkContext } from "../src/react/analytics-context";

const text = flowTextOf(LEAD_CAPTURE_TEXT.fr, "fr");
const SENT: LeadSent = { channel: "form", phone: "06 12 34 56 78", name: "Jean Dupont", lead: "lead-7-0a1b2c3d", submission: "0b6c3f9e-1d2a-4c5b-8e7f-9a0b1c2d3e4f", cents: 8400 };
const NOW = new Date(2026, 9, 4, 10).getTime();

function stand(booking: OpenBookingConfig, over: { sent?: LeadSent; embed?: boolean; adapters?: BookingAdapters } = {}) {
  const events: { event: string; props: Record<string, unknown> }[] = [];
  const sink: AnalyticsSink = { capture: (event, props) => void events.push({ event, props: { ...props } }) };
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json({ ok: true, queued: true }));
  vi.stubGlobal("fetch", fetch);
  const ui: ReactElement = <LeadBooking booking={booking} sent={over.sent ?? SENT} locale="fr" text={text} now={NOW} embed={over.embed} adapters={over.adapters} />;
  render(<AnalyticsSinkContext.Provider value={sink}>{ui}</AnalyticsSinkContext.Provider>);
  const posted = () => fetch.mock.calls.map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init?.body)) as unknown }));
  return { events, fetch, posted };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as { Cal?: unknown }).Cal;
  for (const s of document.querySelectorAll("script")) s.remove();
});

describe("LeadBooking: link and cal_com", () => {
  it("links the page with the ref in the query, and requests nothing before the click", () => {
    const { fetch, posted, events } = stand({ provider: "link", url: "https://book.example.fr/vifnet" });
    const link = screen.getByRole("link", { name: text.bookCta });
    expect(link).toHaveAttribute("href", "https://book.example.fr/vifnet?ref=lead-7-0a1b2c3d");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(posted()).toEqual([{ url: "/quote/booking", body: { submission: SENT.submission, lead_ref: SENT.lead, provider: "link" } }]);
    expect(events).toEqual([{ event: "lead_booking_open", props: { provider: "link", form_id: "quote" } }]);
  });

  it("opens a Google schedule as is, and asks for the same phone there", () => {
    const { posted } = stand({ provider: "google_calendar", url: "https://calendar.app.google/AbC123xyz" });
    const link = screen.getByRole("link", { name: text.bookCta });
    expect(link).toHaveAttribute("href", "https://calendar.app.google/AbC123xyz");
    expect(screen.getByText(text.bookPhoneHint)).toBeInTheDocument();
    fireEvent.click(link);
    expect(posted()).toEqual([{ url: "/quote/booking", body: { submission: SENT.submission, lead_ref: SENT.lead, provider: "google_calendar" } }]);
  });

  it("prefills Cal.com with the name, the phone and metadata[ref]", () => {
    stand({ provider: "cal_com", url: "https://cal.com/vifnet/menage" });
    expect(screen.getByRole("link", { name: text.bookCta })).toHaveAttribute(
      "href",
      "https://cal.com/vifnet/menage?name=Jean%20Dupont&attendeePhoneNumber=%2B33612345678&metadata[ref]=lead-7-0a1b2c3d",
    );
    expect(document.querySelector("script")).toBeNull();
    expect(screen.queryByText(text.bookPhoneHint)).toBeNull();
  });

  it("loads Cal.com's embed only on the click, and reports the booking it announces", async () => {
    const { events } = stand({ provider: "cal_com", url: "https://cal.com/vifnet/menage" }, { embed: true });
    expect(document.querySelector("script")).toBeNull();
    expect((window as { Cal?: unknown }).Cal).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: text.bookCta }));
    expect(document.querySelector("script")?.getAttribute("src")).toBe("https://app.cal.com/embed/embed.js");
    const queue = (window as unknown as { Cal: { q: unknown[][] } }).Cal.q;
    expect(queue).toContainEqual(["modal", { calLink: "vifnet/menage", config: { name: "Jean Dupont", attendeePhoneNumber: "+33612345678", "metadata[ref]": "lead-7-0a1b2c3d" } }]);
    const on = queue.find(([verb, arg]) => verb === "on" && (arg as { action: string }).action === "bookingSuccessful")?.[1] as { callback: (e: unknown) => void };
    on.callback({ detail: { data: { date: "2026-10-06T09:00:00Z" } } });
    expect(await screen.findByText(text.booked)).toBeInTheDocument();
    expect(events.map(e => e.event)).toEqual(["lead_booking_open", "lead_booking_done"]);
  });

  // Review of #185: every click registered its own listeners, and one booking counted once per click.
  it("registers Cal.com's listeners once per page: open, close, open, book is one booking", async () => {
    const { events } = stand({ provider: "cal_com", url: "https://cal.com/vifnet/menage" }, { embed: true });
    const book = screen.getByRole("button", { name: text.bookCta });
    fireEvent.click(book);
    fireEvent.click(book);
    const queue = (window as unknown as { Cal: { q: unknown[][] } }).Cal.q;
    expect(queue.filter(([verb]) => verb === "init")).toHaveLength(1);
    expect(queue.filter(([verb]) => verb === "modal")).toHaveLength(2);
    const listeners = queue.filter(([verb]) => verb === "on").map(([, arg]) => (arg as { callback: (e: unknown) => void }).callback);
    for (const listener of listeners) listener({ detail: { data: {} } });
    expect(await screen.findByText(text.booked)).toBeInTheDocument();
    expect(events.filter(e => e.event === "lead_booking_done")).toHaveLength(1);
    expect(document.querySelectorAll("script")).toHaveLength(1);
  });

  it("only promises the call without the lead's reference", () => {
    const { fetch } = stand({ provider: "link", url: "https://book.example.fr/vifnet" }, { sent: { channel: "form", phone: "06", name: null } });
    expect(screen.getByText(text.slotCallback)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("LeadBooking: a provider the brand registers", () => {
  const acme = { provider: "acme", url: "https://book.acme.example/brand" };

  it("opens through the brand's adapter, and reports its provider", () => {
    const adapters: BookingAdapters = { acme: { provider: "acme", href: ctx => `${ctx.config.url}?ref=${ctx.leadRef}` } };
    const { events } = stand(acme, { adapters });
    const link = screen.getByRole("link", { name: text.bookCta });
    expect(link).toHaveAttribute("href", "https://book.acme.example/brand?ref=lead-7-0a1b2c3d");
    fireEvent.click(link);
    expect(events).toEqual([{ event: "lead_booking_open", props: { provider: "acme", form_id: "quote" } }]);
  });

  it("promises the call when no adapter knows the provider", () => {
    const { fetch } = stand(acme);
    expect(screen.getByText(text.slotCallback)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("LeadBooking: manual", () => {
  it("promises the call and sends an optional preference, day and part of the day", async () => {
    const { posted, events } = stand({ provider: "manual" });
    expect(screen.getByText(text.slotCallback)).toBeInTheDocument();
    const send = screen.getByRole("button", { name: text.preferSubmit });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByLabelText(text.partEvening));
    fireEvent.click(screen.getAllByRole("radio", { name: /\d/ })[0] as HTMLElement);
    fireEvent.click(send);
    expect(await screen.findByText(text.preferSent)).toBeInTheDocument();
    expect(posted()).toEqual([{ url: "/quote/booking", body: { submission: SENT.submission, lead_ref: SENT.lead, provider: "manual", preferred_date: "2026-10-05", preferred_part: "evening" } }]);
    expect(events).toEqual([{ event: "lead_booking_open", props: { provider: "manual", form_id: "quote" } }]);
  });

  it("keeps the form when the request is not taken", async () => {
    const { fetch } = stand({ provider: "manual" });
    fetch.mockResolvedValueOnce(new Response(null, { status: 503 }));
    fireEvent.click(screen.getByLabelText(text.partMorning));
    fireEvent.click(screen.getByRole("button", { name: text.preferSubmit }));
    await waitFor(() => expect(screen.getByRole("button", { name: text.preferSubmit })).toBeEnabled());
    expect(screen.queryByText(text.preferSent)).toBeNull();
    // Review of #185: a brand without the route lost the preference without a word.
    expect(screen.getByText(text.preferFailed)).toBeInTheDocument();
  });
});
