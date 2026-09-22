/**
 * @module @evinvest/experiments/next
 *
 * Next.js server helpers for A/B experiments — server-safe (no `"use client"`
 * banner): `getVariant` reads the assigned cookie in a Server Component, and
 * `abProxy` / `createAbMiddleware` perform the weighted sticky assignment in a
 * proxy (formerly "middleware"). Client cookie helpers (`document.cookie`) live
 * in `./react`, not here, so this module never touches the DOM.
 *
 * Mirror of the `experiments` Cargo feature's Next.js surface.
 */
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import {
  cookieName,
  DEFAULT_COOKIE_PREFIX,
  forcedVariant,
  pickVariant,
  pickVariantFor,
  resolveVariant,
  type AbCookieOptions,
  type ExperimentConfig,
  type ExperimentKey,
  type Variant,
} from '../index';

export type { AbCookieOptions } from '../index';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Options for {@link getVariant}. Omitted = the plain cookie read. */
export type GetVariantOptions = {
  /**
   * Stable subject (e.g. a location id). When set, the variant is
   * {@link pickVariantFor} — no cookie is read, so the route can stay static.
   */
  readonly subject?: string;
  /**
   * A requested variant (e.g. from the page's `searchParams`). Used when it is
   * valid for the key and the experiment is enabled; otherwise ignored.
   */
  readonly force?: string | undefined;
  /** Cookie parameters; only `prefix` matters for reading. */
  readonly cookie?: AbCookieOptions;
};

/** Options for {@link abProxy} / {@link createAbMiddleware}. Omitted = old behaviour. */
export type AbProxyOptions = {
  /** Randomness for new cookie assignments. Default `Math.random`. */
  readonly rng?: () => number;
  /**
   * Resolves a stable subject (e.g. a location id from the host) per request.
   * When it returns a string, every experiment is bucketed with
   * {@link pickVariantFor} and written to the **forwarded request only** — no
   * `Set-Cookie`, nothing sticky, the subject alone decides. `undefined` falls
   * back to the cookie flow.
   */
  readonly subject?: (request: NextRequest) => string | undefined;
  /** Cookie parameters for reading and writing assignments. */
  readonly cookie?: AbCookieOptions;
  /** Requests for which the proxy does nothing (bots, health checks…). */
  readonly skip?: (request: NextRequest) => boolean;
  /**
   * Query-parameter prefix that forces a variant: `?${forceParam}${key}=b`.
   * The value is validated against the declared variants; a forced variant
   * overrides the cookie (and is persisted in cookie mode). Default: off.
   */
  readonly forceParam?: string;
};

/**
 * Reads the visitor's assigned A/B variant from the `ab_<key>` cookie set by
 * {@link abProxy}. Falls back to the first (control) variant when the cookie is
 * missing or holds an unrecognised value, or when the experiment is disabled.
 *
 * With `options.subject` it instead returns {@link pickVariantFor} and never
 * touches `cookies()`; with a valid `options.force` it returns that variant.
 *
 * **Server Component only** — uses `next/headers` and throws if called on the
 * client. Reading the cookie opts the route into dynamic rendering, the
 * inherent cost of cookie-based A/B.
 *
 * @typeParam C - The {@link ExperimentConfig} (pass it `as const` to narrow).
 * @typeParam K - The experiment key.
 * @param config  - The experiments config.
 * @param key     - The experiment key to read.
 * @param options - Optional {@link GetVariantOptions}.
 * @returns The variant string, narrowed to the valid union for that key.
 *
 * @example
 * ```tsx
 * // Inside a Server Component:
 * const variant = await getVariant(config, "hero");
 * // Per-location split on a static page:
 * const byLocation = await getVariant(config, "hero", { subject: location.id });
 * ```
 */
export async function getVariant<
  C extends ExperimentConfig,
  K extends ExperimentKey<C>,
>(config: C, key: K, options: GetVariantOptions = {}): Promise<Variant<C, K>> {
  const forced = forcedVariant(config, key, options.force);
  if (forced !== undefined) return forced;
  if (options.subject !== undefined) return pickVariantFor(config, key, options.subject);
  const jar = await cookies();
  const name = cookieName(key, options.cookie?.prefix ?? DEFAULT_COOKIE_PREFIX);
  return resolveVariant(config, key, jar.get(name)?.value);
}

/**
 * Assigns a sticky variant cookie per experiment on first visit, weighted by
 * {@link pickVariant}. New assignments are written to **both** the forwarded
 * request (so this same render's `cookies()` reads them — no first-paint bias)
 * and the response (so the browser persists them for 30 days). Existing cookies
 * are left untouched, making assignment sticky across visits. Disabled
 * experiments are not assigned.
 *
 * `options` adjusts this without changing the defaults: an injected `rng`,
 * per-subject bucketing with no `Set-Cookie`, cookie parameters, a `skip`
 * predicate and a query-parameter force — see {@link AbProxyOptions}.
 *
 * @typeParam C - The {@link ExperimentConfig}.
 * @param config  - The experiments config to assign across.
 * @param request - The incoming `NextRequest`.
 * @param options - Optional {@link AbProxyOptions}.
 * @returns A `NextResponse` (`NextResponse.next`) carrying any new cookies.
 *
 * @example
 * ```ts
 * // proxy.ts (Next 16) — runtime: nodejs
 * import { abProxy } from "@evinvest/experiments/next";
 * export function proxy(request: NextRequest) {
 *   return abProxy(config, request);
 * }
 * ```
 */
export function abProxy<C extends ExperimentConfig>(
  config: C,
  request: NextRequest,
  options: AbProxyOptions = {},
): NextResponse {
  if (options.skip?.(request)) return NextResponse.next();

  const prefix = options.cookie?.prefix ?? DEFAULT_COOKIE_PREFIX;
  const subject = options.subject?.(request);
  const persisted: Array<{ name: string; value: string }> = [];

  for (const key of Object.keys(config) as ExperimentKey<C>[]) {
    if (config[key]?.enabled === false) continue;
    const name = cookieName(key, prefix);
    const forced =
      options.forceParam === undefined
        ? undefined
        : forcedVariant(config, key, request.nextUrl.searchParams.get(`${options.forceParam}${key}`));

    if (subject !== undefined) {
      // Subject mode overrides whatever cookie the browser sent, so a stale
      // per-device assignment can never beat the per-subject split.
      request.cookies.set(name, forced ?? pickVariantFor(config, key, subject));
      continue;
    }

    const current = request.cookies.get(name)?.value;
    const value = forced ?? (request.cookies.has(name) ? undefined : pickVariant(config, key, options.rng));
    if (value !== undefined && value !== current) {
      request.cookies.set(name, value);
      persisted.push({ name, value });
    }
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  for (const { name, value } of persisted) {
    response.cookies.set(name, value, {
      maxAge: options.cookie?.maxAge ?? COOKIE_MAX_AGE,
      sameSite: options.cookie?.sameSite ?? 'lax',
      httpOnly: false,
      path: options.cookie?.path ?? '/',
      ...(options.cookie?.domain === undefined ? {} : { domain: options.cookie.domain }),
    });
  }

  return response;
}

/**
 * Builds a proxy (middleware) handler bound to a config — the curried form of
 * {@link abProxy}. Export the returned function as your `proxy` (Next 16) /
 * `middleware` (Next ≤ 15).
 *
 * @typeParam C - The {@link ExperimentConfig}.
 * @param config  - The experiments config to assign across.
 * @param options - Optional {@link AbProxyOptions}, forwarded to every call.
 * @returns A `(request: NextRequest) => NextResponse` handler.
 *
 * @example
 * ```ts
 * // proxy.ts
 * import { createAbMiddleware } from "@evinvest/experiments/next";
 * export const proxy = createAbMiddleware(config);
 * export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
 * ```
 */
export function createAbMiddleware<C extends ExperimentConfig>(
  config: C,
  options: AbProxyOptions = {},
): (request: NextRequest) => NextResponse {
  return (request: NextRequest) => abProxy(config, request, options);
}
