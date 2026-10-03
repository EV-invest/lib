import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BookingConfigError,
  bookingConfigProblems,
  bookingHref,
  bookingOf,
  bookingRequestedProperties,
  bookingRequestProblems,
  calComHostsProblems,
  DEFAULT_BOOKING,
  parseBookingConfig,
  parseBookingRequest,
  type BookingConfig,
  type BookingPrefill,
  type BookingRules,
} from "../src/index";

/**
 * The fixtures the panel vendors: its place-settings validator must accept
 * `valid/` and refuse `invalid/` under `rules.json`, its `booking.requested`
 * reader the same for `requested/`, and its link builder must answer every
 * case of `hrefs.json` byte for byte.
 */
const DIR = join(import.meta.dirname, "fixtures/booking");
const read = (path: string): unknown => JSON.parse(readFileSync(join(DIR, path), "utf8"));
const files = (dir: string) => readdirSync(join(DIR, dir)).filter(f => f.endsWith(".json")).sort();
const RULES = read("rules.json") as BookingRules;

describe("the booking config fixtures", () => {
  it.each(files("valid"))("valid/%s validates", file => {
    expect(bookingConfigProblems(read(`valid/${file}`), RULES)).toEqual([]);
  });

  it.each(files("invalid"))("invalid/%s is refused", file => {
    const value = read(`invalid/${file}`);
    expect(bookingConfigProblems(value, RULES).length).toBeGreaterThan(0);
    expect(() => parseBookingConfig(value, RULES)).toThrow(BookingConfigError);
  });

  it("covers every provider", () => {
    const providers = new Set(files("valid").map(f => parseBookingConfig(read(`valid/${f}`), RULES).provider));
    expect([...providers].sort()).toEqual(["cal_com", "link", "manual"]);
  });
});

describe("the booking.requested fixtures", () => {
  it.each(files("requested/valid"))("requested/valid/%s validates and round-trips", file => {
    const value = read(`requested/valid/${file}`);
    expect(bookingRequestProblems(value)).toEqual([]);
    expect(bookingRequestedProperties(parseBookingRequest(value))).toEqual(value);
  });

  it.each(files("requested/invalid"))("requested/invalid/%s is refused", file => {
    const value = read(`requested/invalid/${file}`);
    expect(bookingRequestProblems(value).length).toBeGreaterThan(0);
    expect(() => parseBookingRequest(value)).toThrow(BookingConfigError);
  });
});

interface HrefCase {
  name: string;
  config: BookingConfig;
  prefill: BookingPrefill;
  href: string | null;
}

describe("bookingHref against hrefs.json", () => {
  const cases = read("hrefs.json") as HrefCase[];
  it.each(cases.map(c => [c.name, c] as const))("%s", (_, c) => {
    expect(bookingConfigProblems(c.config, RULES)).toEqual([]);
    expect(bookingHref(c.config, c.prefill)).toBe(c.href);
  });

  it("never puts the reference in a fragment", () => {
    for (const c of cases) if (c.href) expect(new URL(c.href).hash).toBe("");
  });
});

describe("the Cal.com host list", () => {
  it("defaults to the hosted cloud", () => {
    expect(bookingConfigProblems({ provider: "cal_com", url: "https://cal.com/a/b" })).toEqual([]);
    expect(bookingConfigProblems({ provider: "cal_com", url: "https://cal.evinvest.ltd/a/b" })).toHaveLength(1);
  });

  it("is the site's own list when it names one, replacing the default", () => {
    const own = { calComHosts: ["cal.evinvest.ltd"] };
    expect(bookingConfigProblems({ provider: "cal_com", url: "https://cal.evinvest.ltd/a/b" }, own)).toEqual([]);
    expect(bookingConfigProblems({ provider: "cal_com", url: "https://cal.com/a/b" }, own)).toHaveLength(1);
  });

  it("refuses a host list entry that is not a lowercase DNS name", () => {
    expect(calComHostsProblems(["cal.com", "cal.evinvest.ltd"])).toEqual([]);
    expect(calComHostsProblems(["Cal.com", "localhost", "10.0.0.1", "cal.com:443"])).toHaveLength(4);
  });
});

describe("bookingOf", () => {
  it("promises a call when the place names no booking", () => {
    expect(bookingOf({})).toEqual(DEFAULT_BOOKING);
    expect(DEFAULT_BOOKING).toEqual({ provider: "manual" });
    expect(bookingOf({ booking: { provider: "link", url: "https://x.example/a" } }).provider).toBe("link");
  });
});

describe("bookingConfigProblems", () => {
  it("names the field it refuses", () => {
    expect(bookingConfigProblems({ provider: "link", url: "http://x.example/a" })).toEqual(['booking.url: must start with "https://"']);
    expect(bookingConfigProblems({ provider: "manual", url: "https://x.example" })).toEqual(["booking.url: unknown field"]);
  });
});
