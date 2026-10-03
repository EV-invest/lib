import {
  BOOKING_LIMITS as LIMIT,
  DEFAULT_CAL_COM_HOSTS,
  isBookingProvider,
  isLeadRef,
  isPreferredPart,
  type BookingConfig,
  type BookingRequest,
  type BookingRequestedProperties,
  type BookingRules,
} from "./model";

/** A booking config that does not validate, with every reason found. */
export class BookingConfigError extends Error {
  override readonly name = "BookingConfigError";
  constructor(readonly problems: readonly string[]) {
    super(`booking: ${problems.join("; ")}`);
  }
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

function unknownKeys(path: string, v: Json, allowed: readonly string[]): string[] {
  return Object.keys(v)
    .filter(key => !allowed.includes(key))
    .map(key => `${path}.${key}: unknown field`);
}

// Printable ASCII only: the URL parser would quietly drop a tab or a line
// break and re-encode the rest, so what was checked would not be what opens.
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/;
const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
// A last label that is a number (or `0x…`) makes the WHATWG parser read the
// host as an IPv4 address: `https://0x7f000001/` is 127.0.0.1.
const NUMERIC_LABEL = /^(?:\d+|0x[0-9a-f]*)$/i;

/**
 * Every reason `value` is not a booking URL. The rules are the panel's too
 * (`test/fixtures/booking/README.md`): a literal lowercase `https://`, a
 * dotted DNS name for a host — no userinfo, no port, no IP literal — no
 * fragment, printable ASCII, at most 2048 characters.
 */
function urlProblems(path: string, value: unknown): { problems: string[]; url: URL | null; rawPath: string } {
  const fail = (why: string) => ({ problems: [`${path}: ${why}`], url: null, rawPath: "" });
  if (typeof value !== "string") return fail("a URL string");
  if (value.length > LIMIT.maxUrl) return fail(`at most ${LIMIT.maxUrl} characters`);
  if (!PRINTABLE_ASCII.test(value)) return fail("printable ASCII only, no spaces or control characters");
  if (!value.startsWith("https://")) return fail('must start with "https://"');
  if (value.includes("#")) return fail("no fragment");
  if (value.includes("\\")) return fail("no backslash");
  const rest = value.slice("https://".length);
  const end = rest.search(/[/?]/);
  const authority = end === -1 ? rest : rest.slice(0, end);
  if (authority.includes("@")) return fail("no userinfo");
  if (authority.includes(":") || authority.startsWith("[")) return fail("no port and no IP literal");
  const labels = authority.split(".");
  if (labels.length < 2 || authority.length > 253 || !labels.every(l => LABEL.test(l))) return fail("the host must be a dotted DNS name");
  if (NUMERIC_LABEL.test(labels[labels.length - 1] ?? "")) return fail("the host must not be an IP literal");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail("not a URL");
  }
  const query = rest.indexOf("?");
  const rawPath = end === -1 ? "" : rest.slice(end, query === -1 ? undefined : query);
  return { problems: [], url, rawPath };
}

function calComProblems(path: string, url: URL, rawPath: string, rules: BookingRules): string[] {
  const hosts = rules.calComHosts ?? DEFAULT_CAL_COM_HOSTS;
  const out: string[] = [];
  if (!hosts.includes(url.hostname)) out.push(`${path}: the host must be one of ${hosts.join(", ")}`);
  const segments = rawPath.split("/").slice(1);
  if (!rawPath.startsWith("/") || segments.length !== 2 || !segments.every(s => LIMIT.calComSegment.test(s))) {
    out.push(`${path}: the path must be /<user>/<event>`);
  }
  return out;
}

function check(value: unknown, rules: BookingRules): { problems: string[]; config: BookingConfig | null } {
  if (!isObject(value)) return { problems: ["booking: an object"], config: null };
  const provider = value.provider;
  if (!isBookingProvider(provider)) return { problems: [`booking.provider: one of manual, link, cal_com`], config: null };
  if (provider === "manual") {
    const problems = unknownKeys("booking", value, ["provider"]);
    return problems.length > 0 ? { problems, config: null } : { problems: [], config: { provider } };
  }
  const problems = unknownKeys("booking", value, ["provider", "url"]);
  if (!Object.hasOwn(value, "url")) problems.push("booking.url: missing");
  else {
    const parsed = urlProblems("booking.url", value.url);
    problems.push(...parsed.problems);
    if (parsed.url && provider === "cal_com") problems.push(...calComProblems("booking.url", parsed.url, parsed.rawPath, rules));
  }
  if (problems.length > 0 || typeof value.url !== "string") return { problems, config: null };
  return { problems: [], config: { provider, url: value.url } };
}

/**
 * Every reason `value` is not a place's booking, or none. Unknown fields are
 * refused, not ignored — `manual` carries no `url` — so the site and the
 * panel never disagree on what a config says.
 */
export function bookingConfigProblems(value: unknown, rules: BookingRules = {}): string[] {
  return check(value, rules).problems;
}

/** The config `value` is, rebuilt from what was checked; throws `BookingConfigError` with every problem. */
export function parseBookingConfig(value: unknown, rules: BookingRules = {}): BookingConfig {
  const { problems, config } = check(value, rules);
  if (!config) throw new BookingConfigError(problems);
  return config;
}

/** Every reason a host list is not one a site may allow Cal.com on. */
export function calComHostsProblems(hosts: readonly string[]): string[] {
  return hosts.flatMap((host, i) => {
    const labels = host.split(".");
    const dns = host === host.toLowerCase() && labels.length >= 2 && labels.every(l => LABEL.test(l)) && !NUMERIC_LABEL.test(labels[labels.length - 1] ?? "");
    return dns ? [] : [`calComHosts[${i}]: a lowercase dotted DNS name, not ${JSON.stringify(host)}`];
  });
}

/** `YYYY-MM-DD`, and a day the calendar has. */
function isDay(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const day = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === v;
}

function checkRequest(value: unknown): { problems: string[]; request: BookingRequest | null } {
  if (!isObject(value)) return { problems: ["booking.requested: an object"], request: null };
  const problems = unknownKeys("booking.requested", value, ["lead_ref", "provider", "preferred_date", "preferred_part"]);
  const { lead_ref: leadRef, provider, preferred_date: date, preferred_part: part } = value;
  if (!isLeadRef(leadRef)) problems.push("booking.requested.lead_ref: lead-<row>-<8 hex>");
  if (!isBookingProvider(provider)) problems.push("booking.requested.provider: one of manual, link, cal_com");
  if (date !== undefined && !isDay(date)) problems.push("booking.requested.preferred_date: a date, YYYY-MM-DD");
  if (part !== undefined && !isPreferredPart(part)) problems.push("booking.requested.preferred_part: morning, afternoon or evening");
  if ((date !== undefined || part !== undefined) && provider !== "manual") problems.push("booking.requested: a preference only with manual");
  if (problems.length > 0 || !isLeadRef(leadRef) || !isBookingProvider(provider)) return { problems, request: null };
  const request: BookingRequest = { leadRef, provider };
  if (typeof date === "string") request.preferredDate = date;
  if (isPreferredPart(part)) request.preferredPart = part;
  return { problems: [], request };
}

/**
 * Every reason `value` is not `booking.requested@1`'s properties, or none:
 * a `lead_ref`, a provider of the closed set and, with `manual` only, an
 * optional day and part of the day. No free text — nothing a person typed.
 */
export function bookingRequestProblems(value: unknown): string[] {
  return checkRequest(value).problems;
}

/** The request `value` is; throws `BookingConfigError` with every problem. */
export function parseBookingRequest(value: unknown): BookingRequest {
  const { problems, request } = checkRequest(value);
  if (!request) throw new BookingConfigError(problems);
  return request;
}

/** A request as `booking.requested@1`'s properties: snake_case, absent fields left out. */
export function bookingRequestedProperties(request: BookingRequest): BookingRequestedProperties {
  return {
    lead_ref: request.leadRef,
    provider: request.provider,
    ...(request.preferredDate !== undefined ? { preferred_date: request.preferredDate } : {}),
    ...(request.preferredPart !== undefined ? { preferred_part: request.preferredPart } : {}),
  };
}
