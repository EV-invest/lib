import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BookingConfigError,
  bookingConfigProblems,
  bookingHref,
  BOOKING_EXPERIMENT,
  bookingOf,
  bookingRequestedProperties,
  bookingRequestProblems,
  calComHostsProblems,
  DEFAULT_BOOKING,
  parseBookingConfig,
  parseBookingRequest,
  type BookingChoice,
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

  it("covers every provider, as a default and as a page", () => {
    const providers = new Set(files("valid").flatMap(f => {
      const config = parseBookingConfig(read(`valid/${f}`), RULES);
      return [config.default, ...Object.keys(config.providers)];
    }));
    expect([...providers].sort()).toEqual(["cal_com", "google_calendar", "link", "manual"]);
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
  choice: BookingChoice;
  prefill: BookingPrefill;
  href: string | null;
}

describe("bookingHref against hrefs.json", () => {
  const cases = read("hrefs.json") as HrefCase[];
  it.each(cases.map(c => [c.name, c] as const))("%s", (_, c) => {
    if (c.choice.provider !== "manual") expect(bookingConfigProblems({ default: c.choice.provider, providers: { [c.choice.provider]: { url: c.choice.url } } }, RULES)).toEqual([]);
    expect(bookingHref(c.choice, c.prefill)).toBe(c.href);
  });

  it("never puts the reference in a fragment", () => {
    for (const c of cases) if (c.href) expect(new URL(c.href).hash).toBe("");
  });
});

interface ChooseCase {
  name: string;
  booking: BookingConfig | null;
  variant: string | null;
  choice: BookingChoice;
}

describe("bookingOf against choose.json: the booking_provider experiment picks among the place's providers", () => {
  const cases = read("choose.json") as ChooseCase[];
  it.each(cases.map(c => [c.name, c] as const))("%s", (_, c) => {
    if (c.booking) expect(bookingConfigProblems(c.booking, RULES)).toEqual([]);
    expect(bookingOf(c.booking ? { booking: c.booking } : {}, c.variant)).toEqual(c.choice);
  });

  it("takes no inherited name for a provider", () => {
    expect(bookingOf({}, "toString")).toEqual({ provider: "manual" });
    expect(DEFAULT_BOOKING).toEqual({ default: "manual", providers: {} });
    expect(BOOKING_EXPERIMENT).toBe("booking_provider");
  });
});

describe("the Cal.com host list", () => {
  const cal = (url: string) => ({ default: "cal_com", providers: { cal_com: { url } } });

  it("defaults to ours and the hosted cloud", () => {
    expect(bookingConfigProblems(cal("https://cal.com/a/b"))).toEqual([]);
    expect(bookingConfigProblems(cal("https://cal.evinvest.ltd/a/b"))).toEqual([]);
    expect(bookingConfigProblems(cal("https://cal.brand.fr/a/b"))).toHaveLength(1);
  });

  it("is the site's own list when it names one, replacing the default", () => {
    const own = { calComHosts: ["cal.brand.fr"] };
    expect(bookingConfigProblems(cal("https://cal.brand.fr/a/b"), own)).toEqual([]);
    expect(bookingConfigProblems(cal("https://cal.com/a/b"), own)).toHaveLength(1);
  });

  it("refuses a host list entry that is not a lowercase DNS name", () => {
    expect(calComHostsProblems(["cal.com", "cal.evinvest.ltd"])).toEqual([]);
    expect(calComHostsProblems(["Cal.com", "localhost", "10.0.0.1", "cal.com:443"])).toHaveLength(4);
  });
});

describe("bookingConfigProblems", () => {
  it("names the field it refuses", () => {
    expect(bookingConfigProblems({ default: "link", providers: { link: { url: "http://x.example/a" } } })).toEqual(['booking.providers.link.url: must start with "https://"']);
    expect(bookingConfigProblems({ default: "google_calendar", providers: {} })).toEqual(['booking.default: "google_calendar" is not one of the providers']);
  });
});
