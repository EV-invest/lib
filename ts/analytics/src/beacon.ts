import { withPropPolicy, type PropPolicy, type PropValue } from "./props";
import { resolveHost, type PostHogTarget } from "./region";
import { noopSink, type AnalyticsSink } from "./sink";

/** The `$lib` marker `ev_lib::analytics::capture_body` stamps on every event. */
const LIB_MARKER = "ev-analytics";

// Rust orders map keys by UTF-8 bytes, which is code-point order; JS `<` on
// strings compares UTF-16 code units, which disagrees above the BMP.
function byCodePoint(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i]?.codePointAt(0) ?? 0) - (right[i]?.codePointAt(0) ?? 0);
    if (diff !== 0) return diff;
  }
  return left.length - right.length;
}

// serde_json formats floats with `ryu`, which agrees with `JSON.stringify` for
// every finite non-integer except magnitudes in [1e-6, 1e-5): there `ryu`
// switches to exponent form one decade earlier. Integers go through Rust's
// `PropValue::Int`, which `JSON.stringify` already matches.
function formatNumber(value: number): string {
  const magnitude = Math.abs(value);
  if (Number.isFinite(value) && magnitude >= 1e-6 && magnitude < 1e-5) {
    return value.toExponential();
  }
  return JSON.stringify(value);
}

function formatValue(value: PropValue): string {
  return typeof value === "number" ? formatNumber(value) : JSON.stringify(value);
}

function isPropValue(value: unknown): value is PropValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Serializes the JSON body for PostHog's `POST /capture/` — byte for byte what
 * `serde_json::to_string(&ev_lib::analytics::capture_body(..))` produces, so a
 * Rust (wasm) front end and a TS one are interchangeable on the wire.
 *
 * Keys are sorted (serde_json's map is a `BTreeMap`), `$lib` is set to
 * `"ev-analytics"` and overwrites a caller's `$lib`, non-finite numbers become
 * `null`. Values that are not `string` / `number` / `boolean` are skipped: Rust
 * cannot express them.
 *
 * @remarks
 * Byte identity holds for strings, booleans, safe integers, and finite
 * non-integers. Integers beyond `Number.MAX_SAFE_INTEGER` are not
 * representable on either side the same way — keep counts small.
 *
 * @example
 * ```ts
 * captureBody("phc_key", "anon-1", "app_booted");
 * // '{"api_key":"phc_key","distinct_id":"anon-1","event":"app_booted","properties":{"$lib":"ev-analytics"}}'
 * ```
 */
export function captureBody(
  apiKey: string,
  distinctId: string,
  event: string,
  props?: Readonly<Record<string, unknown>>,
): string {
  const properties = new Map<string, PropValue>();
  for (const [key, value] of Object.entries(props ?? {})) {
    if (isPropValue(value)) properties.set(key, value);
  }
  properties.set("$lib", LIB_MARKER);

  const renderedProps = [...properties.entries()]
    .sort(([a], [b]) => byCodePoint(a, b))
    .map(([key, value]) => `${JSON.stringify(key)}:${formatValue(value)}`)
    .join(",");

  return (
    `{"api_key":${JSON.stringify(apiKey)}` +
    `,"distinct_id":${JSON.stringify(distinctId)}` +
    `,"event":${JSON.stringify(event)}` +
    `,"properties":{${renderedProps}}}`
  );
}

/**
 * Sends `body` so that it survives the page unloading: `navigator.sendBeacon`
 * first, a `keepalive` fetch when the beacon is unavailable or refused (queue
 * full, payload over the browser's limit). Never throws — a failed capture
 * must not surface to a visitor whose goal is the phone call they just
 * started.
 *
 * Both paths send `text/plain`, a CORS "simple" request with no preflight; the
 * PostHog capture endpoint parses the JSON body regardless.
 */
export function deliverBeacon(url: string, body: string): void {
  try {
    const navigator: unknown = Reflect.get(globalThis, "navigator");
    const send: unknown =
      typeof navigator === "object" && navigator !== null
        ? Reflect.get(navigator, "sendBeacon")
        : undefined;
    if (typeof send === "function" && Reflect.apply(send, navigator, [url, body]) === true) {
      return;
    }
    if (typeof fetch === "function") {
      fetch(url, { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Analytics records; it never breaks the page.
  }
}

function randomId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Configuration for {@link createBeaconSink}. The target (`region` or `host`)
 * is required: this sink has no legacy consumers, so it has no reason to
 * inherit an implicit region.
 */
export type BeaconSinkConfig = PostHogTarget &
  PropPolicy & {
    /**
     * PostHog project API key. When omitted (or empty), the sink no-ops and
     * never touches the network.
     */
    key?: string | undefined;
    /**
     * The `distinct_id` stamped on every event. Defaults to a random id held
     * in memory for the life of the sink — cookieless: nothing is written to
     * cookies or storage, so a reload is a new visitor.
     */
    distinctId?: string;
  };

/**
 * Builds an SDK-free {@link AnalyticsSink} that posts every event to PostHog's
 * `/capture/` via {@link deliverBeacon}, with the exact payload of
 * `ev_lib::analytics::capture_body` ({@link captureBody}).
 *
 * This is the cookieless, script-free path: no `posthog-js`, no autocapture,
 * no persistence, and every event survives navigation (clicks on `tel:` /
 * `wa.me`). `options.transport` is ignored — every event is a beacon.
 *
 * @example
 * ```ts
 * const sink = createBeaconSink({
 *   key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
 *   region: "eu",
 *   allowedProps: ["brand_id", "location_id", "channel"],
 *   globalProps: { brand_id: "aquafix", location_id: "warsaw" },
 * });
 * sink.capture("contact_intent_click", { channel: "phone" });
 * ```
 */
export function createBeaconSink(config: BeaconSinkConfig): AnalyticsSink {
  const { key } = config;
  const url = `${resolveHost(config, "").replace(/\/+$/, "")}/capture/`;
  const distinctId = config.distinctId ?? randomId();
  const inner: AnalyticsSink = key
    ? {
        capture(event, props) {
          deliverBeacon(url, captureBody(key, distinctId, event, props));
        },
      }
    : noopSink();
  return withPropPolicy(inner, config);
}
