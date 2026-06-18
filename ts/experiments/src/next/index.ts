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
  pickVariant,
  resolveVariant,
  type ExperimentConfig,
  type ExperimentKey,
  type Variant,
} from '../index';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Reads the visitor's assigned A/B variant from the `ab_<key>` cookie set by
 * {@link abProxy}. Falls back to the first (control) variant when the cookie is
 * missing or holds an unrecognised value.
 *
 * **Server Component only** — uses `next/headers` and throws if called on the
 * client. Reading the cookie opts the route into dynamic rendering, the
 * inherent cost of cookie-based A/B.
 *
 * @typeParam C - The {@link ExperimentConfig} (pass it `as const` to narrow).
 * @typeParam K - The experiment key.
 * @param config - The experiments config.
 * @param key    - The experiment key to read.
 * @returns The variant string, narrowed to the valid union for that key.
 *
 * @example
 * ```tsx
 * // Inside a Server Component:
 * const variant = await getVariant(config, "hero");
 * ```
 */
export async function getVariant<
  C extends ExperimentConfig,
  K extends ExperimentKey<C>,
>(config: C, key: K): Promise<Variant<C, K>> {
  const jar = await cookies();
  return resolveVariant(config, key, jar.get(cookieName(key))?.value);
}

/**
 * Assigns a sticky variant cookie per experiment on first visit, weighted by
 * {@link pickVariant}. New assignments are written to **both** the forwarded
 * request (so this same render's `cookies()` reads them — no first-paint bias)
 * and the response (so the browser persists them for 30 days). Existing cookies
 * are left untouched, making assignment sticky across visits.
 *
 * @typeParam C - The {@link ExperimentConfig}.
 * @param config  - The experiments config to assign across.
 * @param request - The incoming `NextRequest`.
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
): NextResponse {
  const assigned: Array<{ name: string; value: string }> = [];

  for (const key of Object.keys(config) as ExperimentKey<C>[]) {
    const name = cookieName(key);
    if (!request.cookies.get(name)) {
      const value = pickVariant(config, key);
      request.cookies.set(name, value);
      assigned.push({ name, value });
    }
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  for (const { name, value } of assigned) {
    response.cookies.set(name, value, {
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
      httpOnly: false,
      path: '/',
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
 * @param config - The experiments config to assign across.
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
): (request: NextRequest) => NextResponse {
  return (request: NextRequest) => abProxy(config, request);
}
