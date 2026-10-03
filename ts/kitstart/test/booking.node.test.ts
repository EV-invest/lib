import { describe, expect, it } from "vitest";
import { bookingFrameUrl, EVENTS, ALLOWED_PROPS, flowTextOf, formatCents, isBookingScheduled, LEAD_CAPTURE_TEXT, type LeadCaptureText } from "../src/index";

describe("bookingFrameUrl", () => {
  const prefill = { name: "Ana Lopes", phone: "06 12 34 56 78", leadRef: "lead-12-0a1b2c3d", embedDomain: "vifnet.fr" };

  it("frames the scheduling page for the lead: embed parameters, the visitor, and the reference", () => {
    const url = new URL(bookingFrameUrl("https://calendly.com/vifnet/menage?month=2026-10", prefill) ?? "");
    expect(url.origin + url.pathname).toBe("https://calendly.com/vifnet/menage");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      month: "2026-10",
      embed_domain: "vifnet.fr",
      embed_type: "Inline",
      name: "Ana Lopes",
      a1: "06 12 34 56 78",
      utm_content: "lead-12-0a1b2c3d",
    });
  });

  it("leaves out what it does not know", () => {
    const url = new URL(bookingFrameUrl("https://calendly.com/vifnet/menage", { ...prefill, name: null, phone: null, leadRef: null }) ?? "");
    expect([...url.searchParams.keys()]).toEqual(["embed_domain", "embed_type"]);
  });

  it("frames nothing but a Calendly page", () => {
    expect(bookingFrameUrl("https://evil.example/vifnet", prefill)).toBeNull();
    expect(bookingFrameUrl("https://calendly.com/", prefill)).toBeNull();
  });
});

describe("isBookingScheduled", () => {
  it("is Calendly's own event_scheduled, from its origin only", () => {
    expect(isBookingScheduled({ origin: "https://calendly.com", data: { event: "calendly.event_scheduled" } })).toBe(true);
    expect(isBookingScheduled({ origin: "https://calendly.com", data: { event: "calendly.page_height" } })).toBe(false);
    expect(isBookingScheduled({ origin: "https://calendly.com.evil.example", data: { event: "calendly.event_scheduled" } })).toBe(false);
    expect(isBookingScheduled({ origin: "https://calendly.com", data: "calendly.event_scheduled" })).toBe(false);
    expect(isBookingScheduled({ origin: "https://calendly.com", data: null })).toBe(false);
  });
});

describe("formatCents", () => {
  it("writes euros in the page's language, cents only when there are some", () => {
    expect(formatCents(8400, "fr")).toMatch(/^84\s€$/);
    expect(formatCents(8450, "fr")).toMatch(/^84,50\s€$/);
    expect(formatCents(8450, "en")).toBe("€84.50");
    expect(formatCents(850, "fr", true)).toMatch(/^\+8,50\s€$/);
    expect(formatCents(-935, "fr", true)).toMatch(/^−9,35\s€$/);
    expect(formatCents(0, "fr")).toMatch(/^0\s€$/);
  });
});

describe("the flows' words", () => {
  it("fall back to the kit's, in the page's language, key by key", () => {
    expect(flowTextOf({ ...LEAD_CAPTURE_TEXT.fr, bookingCta: "Réserver mon créneau" }, "fr").bookingCta).toBe("Réserver mon créneau");
    const older: LeadCaptureText = { ...LEAD_CAPTURE_TEXT.en };
    delete older.bookingCta;
    expect(flowTextOf(older, "en-GB").bookingCta).toBe("Pick a slot");
    expect(flowTextOf(older, "de").bookingCta).toBe("Choisir un créneau");
  });
});

describe("the flows' events", () => {
  it("are named, and carry only allowed properties", () => {
    expect([EVENTS.estimateShown, EVENTS.bookingOpen, EVENTS.bookingDone]).toEqual(["lead_estimate_shown", "lead_booking_open", "lead_booking_done"]);
    for (const prop of ["need", "flow", "cents_bucket"]) expect(ALLOWED_PROPS).toContain(prop);
  });
});
