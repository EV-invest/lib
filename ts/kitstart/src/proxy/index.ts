/**
 * `@evinvest/kitstart/proxy` — the routing decision applied to a live request.
 * Edge-safe: it reads only the core and `next/server`.
 *
 * It hands a page nothing but the path it rewrites to. A page that read a
 * request header would render per request, and every page here is cached
 * (ISR); the link mode rides in the route param instead (`/fr/_royat`). The
 * one header it sets goes to the 404 route (`GONE_HEADER`), which is not a
 * page of any segment — and a client-sent copy of it is stripped from every
 * request, so it cannot pick a 404's place or language.
 *
 * The brand's `proxy.ts` keeps its `config.matcher` a literal — Next reads it
 * statically — and takes the handler from here:
 *
 * ```ts
 * export const proxy = createProxy(site);
 * export const config = { matcher: ["/((?!_next/|.*\\.[a-z0-9]+$).*)"] };
 * ```
 */
// `next/server.js`, not `next/server`: `next` has no `exports` map, so plain
// Node ESM resolves only the file name. Every bundler accepts both.
import { NextResponse, type NextRequest } from "next/server.js";
import { createRouting, GONE_HEADER, goneHeader, gonePath, LANG_COOKIE, LANG_COOKIE_MAX_AGE } from "../core/routing";
import type { Site } from "../core/site";

/** The bare URL's answer depends on both; a shared cache must key on them. */
const VARY = "Accept-Language, Cookie";

/** A redirect chosen for this visitor: no cache may keep it for the next. */
const PER_VISITOR = "private, no-store";

/**
 * The matcher the brand's `proxy.ts` spells out: everything but the build
 * output and files with an extension. `/quote`, `/og` and `/health` enter and
 * pass through `decide`, which owns the list of what is a page. Exported so a
 * contract test can compare the brand's literal against it.
 */
export const PROXY_MATCHER = "/((?!_next/|.*\\.[a-z0-9]+$).*)";

export function createProxy<L extends string, P extends string>(site: Site<L, P>): (request: NextRequest) => NextResponse {
  const routing = createRouting(site);

  /** Onward, minus a client-sent gone header; untouched (no override) when there is none. */
  const onward = (request: NextRequest, rewrite: URL | null): NextResponse => {
    if (!request.headers.has(GONE_HEADER)) return rewrite ? NextResponse.rewrite(rewrite) : NextResponse.next();
    const headers = new Headers(request.headers);
    headers.delete(GONE_HEADER);
    return rewrite ? NextResponse.rewrite(rewrite, { request: { headers } }) : NextResponse.next({ request: { headers } });
  };

  return function proxy(request) {
    const url = request.nextUrl;
    const decision = routing.decide({
      host: request.headers.get("host") ?? url.host,
      pathname: url.pathname,
      query: url.searchParams,
      acceptLanguage: request.headers.get("accept-language"),
      cookieLang: request.cookies.get(LANG_COOKIE)?.value ?? null,
    });

    switch (decision.kind) {
      case "pass":
        return onward(request, null);
      case "moved":
        return NextResponse.redirect(new URL(decision.location, url), 301);
      case "negotiate": {
        const response = NextResponse.redirect(new URL(decision.location, url), 302);
        response.headers.set("Vary", VARY);
        response.headers.set("Cache-Control", PER_VISITOR);
        return response;
      }
      case "choose": {
        const response = NextResponse.redirect(new URL(decision.location, url), 303);
        response.headers.set("Cache-Control", PER_VISITOR);
        response.cookies.set(LANG_COOKIE, decision.locale, {
          path: "/",
          maxAge: LANG_COOKIE_MAX_AGE,
          sameSite: "lax",
          httpOnly: true,
          secure: true,
        });
        return response;
      }
      case "serve":
        // No `Vary`: every page's language is in its path, so a prefixed page
        // is the same bytes for every visitor (and Next overwrites `Vary` on
        // rendered pages anyway).
        return onward(request, decision.pathname === url.pathname ? null : new URL(`${decision.pathname}${url.search}`, url));
      case "gone": {
        // To a path no route matches, which Next answers 404 from
        // `app/global-not-found.tsx` — the one reader of the header.
        const headers = new Headers(request.headers);
        headers.set(GONE_HEADER, goneHeader(decision.locale, decision.location));
        return NextResponse.rewrite(new URL(gonePath(decision.locale), url), { request: { headers } });
      }
    }
  };
}

export { GONE_HEADER, LANG_COOKIE, LANG_COOKIE_MAX_AGE } from "../core/routing";
