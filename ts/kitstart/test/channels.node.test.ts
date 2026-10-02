import { describe, expect, it } from "vitest";
import {
  channelHref,
  isMobilePhone,
  isOpenAt,
  isPlausiblePhone,
  nextOpening,
  normalizePhone,
  resolveChannels,
  smsHref,
  type OpeningHours,
} from "../src/index";

const WEEKDAYS: readonly OpeningHours[] = [{ days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "19:00" }];

// Paris is UTC+2 in October 2026 (summer time ends on the 25th).
const MONDAY_10H = new Date("2026-10-05T08:00:00Z");
const MONDAY_7H = new Date("2026-10-05T05:00:00Z");
const FRIDAY_20H = new Date("2026-10-09T18:00:00Z");
const SATURDAY_NOON = new Date("2026-10-10T10:00:00Z");

describe("a phone number", () => {
  it.each([
    ["06 12 34 56 78", "+33612345678"],
    ["06.12.34.56.78", "+33612345678"],
    ["+33 6 12 34 56 78", "+33612345678"],
    ["+33 (0)6 12 34 56 78", "+33612345678"],
    ["0033 6 12 34 56 78", "+33612345678"],
    ["6 12 34 56 78", "+33612345678"],
    ["01 23 45 67 89", "+33123456789"],
    ["+44 7911 123456", "+447911123456"],
  ])("reads %s as %s", (raw, e164) => {
    expect(normalizePhone(raw)).toBe(e164);
    expect(isPlausiblePhone(raw)).toBe(true);
  });

  it.each(["0612", "", "+33 6 12 34", "+33 6 12 34 56 78 90", "06 12 34 56 7a", "call me"])("does not read %j, and says so softly", raw => {
    expect(normalizePhone(raw)).toBeNull();
    expect(isPlausiblePhone(raw)).toBe(false);
  });

  it("knows a French mobile from a landline", () => {
    expect(isMobilePhone("07 12 34 56 78")).toBe(true);
    expect(isMobilePhone("+33 6 12 34 56 78")).toBe(true);
    expect(isMobilePhone("01 23 45 67 89")).toBe(false);
    expect(isMobilePhone("+44 7911 123456")).toBe(false);
  });
});

describe("opening hours", () => {
  it("says open or closed at the place's wall clock, not the server's", () => {
    expect(isOpenAt(WEEKDAYS, MONDAY_10H)).toBe(true);
    expect(isOpenAt(WEEKDAYS, MONDAY_7H)).toBe(false);
    expect(isOpenAt(WEEKDAYS, FRIDAY_20H)).toBe(false);
    expect(isOpenAt(WEEKDAYS, SATURDAY_NOON)).toBe(false);
    // 08:00Z is 09:00 in London, still open; 05:00Z is 06:00 there, closed.
    expect(isOpenAt(WEEKDAYS, MONDAY_7H, "Europe/London")).toBe(false);
  });

  it("guesses nothing without hours", () => {
    expect(isOpenAt(null, MONDAY_10H)).toBeNull();
    expect(isOpenAt([], MONDAY_10H)).toBeNull();
    expect(nextOpening(null, MONDAY_7H)).toBeNull();
  });

  it("names the next opening from the real hours: today, tomorrow, after the weekend", () => {
    expect(nextOpening(WEEKDAYS, MONDAY_7H)).toEqual({ day: "Monday", time: "08:00", inDays: 0 });
    expect(nextOpening(WEEKDAYS, new Date("2026-10-05T18:00:00Z"))).toEqual({ day: "Tuesday", time: "08:00", inDays: 1 });
    expect(nextOpening(WEEKDAYS, FRIDAY_20H)).toEqual({ day: "Monday", time: "08:00", inDays: 3 });
    expect(nextOpening(WEEKDAYS, SATURDAY_NOON)).toEqual({ day: "Monday", time: "08:00", inDays: 2 });
    expect(nextOpening(WEEKDAYS, MONDAY_10H)).toBeNull();
  });

  it("runs an overnight slot past midnight, without calling its tail an opening", () => {
    const nights: readonly OpeningHours[] = [{ days: ["Friday"], opens: "22:00", closes: "02:00" }];
    expect(isOpenAt(nights, new Date("2026-10-09T21:00:00Z"))).toBe(true); // Fri 23:00
    expect(isOpenAt(nights, new Date("2026-10-09T23:00:00Z"))).toBe(true); // Sat 01:00
    expect(isOpenAt(nights, new Date("2026-10-10T01:00:00Z"))).toBe(false); // Sat 03:00
    expect(nextOpening(nights, new Date("2026-10-10T01:00:00Z"))).toEqual({ day: "Friday", time: "22:00", inDays: 6 });
  });

  it("opens a split day twice", () => {
    const split: readonly OpeningHours[] = [
      { days: ["Monday"], opens: "08:00", closes: "12:00" },
      { days: ["Monday"], opens: "14:00", closes: "18:00" },
    ];
    expect(isOpenAt(split, new Date("2026-10-05T11:00:00Z"))).toBe(false); // 13:00
    expect(nextOpening(split, new Date("2026-10-05T11:00:00Z"))).toEqual({ day: "Monday", time: "14:00", inDays: 0 });
  });
});

describe("the channel resolver", () => {
  const MOBILE = "+33 6 12 34 56 78";
  const LANDLINE = "+33 1 23 45 67 89";

  it("puts the call first while someone answers", () => {
    const r = resolveChannels({ phone: MOBILE, whatsapp: MOBILE, hours: WEEKDAYS }, { now: MONDAY_10H });
    expect(r.order).toEqual(["phone", "whatsapp", "sms", "form", "callback"]);
    expect(r.open).toBe(true);
    expect(r.nextOpening).toBeNull();
  });

  it("puts the callback and WhatsApp first when closed, the call last, and says when it reopens", () => {
    const r = resolveChannels({ phone: MOBILE, whatsapp: MOBILE, hours: WEEKDAYS }, { now: FRIDAY_20H });
    expect(r.order).toEqual(["callback", "whatsapp", "form", "sms", "phone"]);
    expect(r.open).toBe(false);
    expect(r.nextOpening).toEqual({ day: "Monday", time: "08:00", inDays: 3 });
  });

  it("orders as open, and promises nothing, when the place has no hours", () => {
    const r = resolveChannels({ phone: MOBILE, whatsapp: null, hours: null }, { now: FRIDAY_20H });
    expect(r.order).toEqual(["phone", "sms", "form", "callback"]);
    expect(r.open).toBeNull();
    expect(r.nextOpening).toBeNull();
  });

  it("drops what the place cannot answer: no phone, no call, text or WhatsApp", () => {
    expect(resolveChannels({ phone: null, whatsapp: null, hours: WEEKDAYS }, { now: MONDAY_10H }).order).toEqual(["form", "callback"]);
    expect(resolveChannels({ phone: null, whatsapp: null, hours: WEEKDAYS }, { now: FRIDAY_20H }).order).toEqual(["callback", "form"]);
  });

  it("offers a text only to a mobile, unless told", () => {
    expect(resolveChannels({ phone: LANDLINE, whatsapp: null, hours: null }, { now: MONDAY_10H }).order).not.toContain("sms");
    expect(resolveChannels({ phone: LANDLINE, whatsapp: null, hours: null, sms: true }, { now: MONDAY_10H }).order).toContain("sms");
    expect(resolveChannels({ phone: MOBILE, whatsapp: null, hours: null, sms: false }, { now: MONDAY_10H }).order).not.toContain("sms");
  });

  it("leaves the callback out where it cannot be posted", () => {
    expect(resolveChannels({ phone: null, whatsapp: null, hours: null, callback: false }, { now: MONDAY_10H }).order).toEqual(["form"]);
  });

  it("moves the preferred channel first only when it exists", () => {
    const facts = { phone: MOBILE, whatsapp: null, hours: WEEKDAYS };
    expect(resolveChannels(facts, { now: MONDAY_10H, prefer: "form" }).order[0]).toBe("form");
    expect(resolveChannels(facts, { now: MONDAY_10H, prefer: "whatsapp" }).order[0]).toBe("phone");
  });

  it("links each channel, with the need in the prefilled message", () => {
    const facts = { phone: "06 12 34 56 78", whatsapp: "+33 6 12 34 56 78" };
    expect(channelHref("phone", facts)).toBe("tel:0612345678");
    expect(channelHref("whatsapp", facts, "Fuite d’eau")).toBe(`https://wa.me/33612345678?text=${encodeURIComponent("Fuite d’eau")}`);
    expect(channelHref("sms", facts, "Fuite")).toBe("sms:+33612345678?&body=Fuite");
    expect(channelHref("callback", facts)).toBeNull();
    expect(channelHref("form", facts)).toBeNull();
    expect(channelHref("phone", { phone: null, whatsapp: null })).toBeNull();
    expect(smsHref("06 12 34 56 78")).toBe("sms:+33612345678");
  });
});
