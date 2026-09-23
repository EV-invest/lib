import type { LinkMode } from "./place/view";
import type { Site } from "./site";

/**
 * Which place and which language a request gets, decided before any route
 * renders. Pure, so it is tested without a server — and mirrored by the Rust
 * `kitstart` feature against `tests/fixtures/kitstart/decide.json`.
 *
 * ```text
 * <slug>.<domain>/fr/prices      → /fr/_<slug>/prices   (host link mode)
 * <domain>/fr/<slug>/prices      → as it is             (path link mode, apex fallback)
 * single site: /fr/prices        → /fr/_<place>/prices  (host link mode)
 * /fr/_<slug>/…                  → as it is             (Next re-enters the proxy with it)
 * ?lang=<l> on a page            → cookie for a year, 303 to the clean URL
 * a `legacyRedirects` path       → 301 to where it moved
 * unprefixed page                → 302 to /<cookie ?? Accept-Language>/…
 * any other path                 → gone: the 404 in the page's (or the
 *                                  negotiated) language, for its place
 * /quote, /og, /health, /_next/…, a file with an extension → pass
 * ```
 *
 * The link mode rides in the path, never in a request header: a page that read
 * a header would render per request, and every page here is cached (ISR). In
 * the path, each mode is its own cache entry, and the two modes' different
 * links can never share one.
 *
 * The negotiation is a **302**, never a 301: the choice is per visitor and
 * must not be cached as permanent. Only page paths enter it — `/quote`,
 * `/sitemap.xml`, `/og` and assets pass straight through.
 */

/** Not indexable, not in the sitemap, but negotiated like any other page. */
export const THANKS = "/thanks";

export const LANG_COOKIE = "lang";
export const LANG_COOKIE_MAX_AGE = 31_536_000;

/** The prefix a `[location]` route param carries in host link mode. */
export const HOST_MARK = "_";

/**
 * How a dead path reaches a 404 a visitor without JavaScript can read.
 *
 * Next 16 cannot put a `notFound()` boundary into the HTML: that response is
 * an empty `<html id="__next_error__">` the client fills in after hydration.
 * What it does render on the server is a path no route matches — through
 * `app/global-not-found.tsx`. The proxy knows every place and every page, so
 * it rewrites a dead path to `/<locale>/404/404`, which matches nothing, and
 * says which language and place the 404 speaks for in {@link GONE_HEADER}.
 * Reserved: no place may take `404` as its slug.
 */
export const GONE = "404";

/** The path no route matches, in a language. */
export function gonePath(locale: string): string {
  return `/${locale}/${GONE}/${GONE}`;
}

/**
 * Set only by the proxy, on a `gone` rewrite, and stripped from every other
 * request; read only by the global not-found page, a route of its own — a
 * page that read it would render per request, and none does.
 */
export const GONE_HEADER = "x-landing-not-found";

/** `fr` or `fr/_royat`: the 404's language and, if it has one, its place. */
export function goneHeader(locale: string, location: string | null): string {
  return location ? `${locale}/${location}` : locale;
}

/** Inverse of {@link goneHeader}; anything absent or malformed reads as nothing. */
export function parseGoneHeader(value: string | null): { locale?: string; location?: string } {
  const [locale, location, extra] = (value ?? "").split("/");
  if (extra !== undefined) return {};
  return { ...(locale ? { locale } : {}), ...(location ? { location } : {}) };
}

/**
 * Paths that are not pages and pass untouched, besides `/_next/…` and any
 * file with an extension (`/sitemap.xml`, `/robots.txt`, assets): the form
 * target, the OG card and the probe.
 */
export const PASS_PATHS: readonly string[] = ["/quote", "/og", "/health"];

function isInfrastructure(pathname: string): boolean {
  if (PASS_PATHS.includes(pathname) || pathname.startsWith("/_next/")) return true;
  const last = pathname.slice(pathname.lastIndexOf("/") + 1);
  return /\.[a-z0-9]+$/i.test(last);
}

/** The `[location]` param for a slug in a mode: `_royat` on its host, `royat` through the apex. */
export function placeParam(slug: string, mode: LinkMode): string {
  return mode === "host" ? `${HOST_MARK}${slug}` : slug;
}

/** Inverse of {@link placeParam}. */
export function parsePlaceParam(param: string): { slug: string; mode: LinkMode } {
  return param.startsWith(HOST_MARK) ? { slug: param.slice(HOST_MARK.length), mode: "host" } : { slug: param, mode: "path" };
}

/** Every suffix the proxy treats as a page of a place. */
export function pointSuffixes<L extends string, P extends string>(site: Site<L, P>): string[] {
  return [...site.pageKeys.map(k => site.pages[k]), THANKS];
}

export interface RequestFacts {
  host: string;
  pathname: string;
  query: URLSearchParams;
  acceptLanguage: string | null;
  cookieLang: string | null;
}

export type Decision<L extends string> =
  | { kind: "pass" }
  | { kind: "negotiate"; location: string }
  | { kind: "choose"; location: string; locale: L }
  | { kind: "moved"; location: string }
  | { kind: "serve"; pathname: string }
  /** A dead path: the 404 in `locale`, for a place's param or (`null`) the brand. */
  | { kind: "gone"; locale: L; location: string | null };

export interface Routing<L extends string> {
  /**
   * The place a host names: `royat.<domain>` → `"royat"`, `royat.localhost:3000`
   * too, for local work. On a `single` site every host is the one place.
   */
  hostSlug(host: string): string | null;
  decide(req: RequestFacts): Decision<L>;
}

function withQuery(path: string, query: URLSearchParams): string {
  const rest = new URLSearchParams(query);
  rest.delete("lang");
  const qs = rest.toString();
  return qs ? `${path}?${qs}` : path;
}

export function createRouting<L extends string, P extends string>(site: Site<L, P>): Routing<L> {
  const { i18n, placeSlugs, topology } = site;
  const suffixes = pointSuffixes(site);
  const hosts = [site.brand.domain, "localhost"].filter((h): h is string => h !== null);

  function hostSlug(host: string): string | null {
    if (topology.kind === "single") return topology.place;
    const name = host.toLowerCase().replace(/:\d+$/, "");
    for (const base of hosts) {
      if (name.endsWith(`.${base}`)) {
        const sub = name.slice(0, -(base.length + 1));
        return placeSlugs.includes(sub) ? sub : null;
      }
    }
    return null;
  }

  function legacy(locale: L | null, rest: string): string | null {
    for (const redirect of site.legacyRedirects ?? []) {
      if (redirect.from !== rest) continue;
      const to = redirect.to(locale);
      if (to !== null) return to;
    }
    return null;
  }

  /** Is `rest` (locale-free) a page this host serves? */
  function isPage(rest: string, slug: string | null): boolean {
    if (slug) return suffixes.includes(rest);
    if (rest === "" || rest === THANKS) return true; // the brand's own pages
    const [, first = "", ...more] = rest.split("/");
    const suffix = more.length ? `/${more.join("/")}` : "";
    return placeSlugs.includes(first) && suffixes.includes(suffix);
  }

  function split(pathname: string): { locale: L | null; rest: string } {
    const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    const [, first = "", ...more] = trimmed.split("/");
    if (i18n.isLocale(first)) return { locale: first, rest: more.length ? `/${more.join("/")}` : "" };
    return { locale: null, rest: trimmed === "/" ? "" : trimmed };
  }

  function decide(req: RequestFacts): Decision<L> {
    const { locale, rest } = split(req.pathname);
    if (locale === null && isInfrastructure(req.pathname)) return { kind: "pass" };

    if (locale !== null) {
      // The 404's own target passes, keeping the header it was sent with.
      if (rest === `/${GONE}/${GONE}`) return { kind: "serve", pathname: req.pathname };
      // Next renders a cached page by running the proxy again, host-less, on
      // the path it was rewritten to; that path must come out as it went in.
      const [, first = "", ...more] = rest.split("/");
      if (first.startsWith(HOST_MARK)) {
        const named = parsePlaceParam(first);
        if (!placeSlugs.includes(named.slug)) return { kind: "gone", locale, location: null };
        const suffix = more.length ? `/${more.join("/")}` : "";
        return suffixes.includes(suffix) ? { kind: "serve", pathname: req.pathname } : { kind: "gone", locale, location: first };
      }
    }

    const slug = hostSlug(req.host);
    if (!slug || topology.kind === "single") {
      const moved = legacy(locale, rest);
      if (moved) return { kind: "moved", location: withQuery(moved, req.query) };
    }

    const page = isPage(rest, slug);
    if (page) {
      const asked = req.query.get("lang");
      if (i18n.isLocale(asked)) {
        // The visitor chose, so record it and take the query back out — a shared
        // or bookmarked link should not keep re-asserting a language.
        return { kind: "choose", locale: asked, location: withQuery(i18n.localePath(asked, rest || "/"), req.query) };
      }
    }
    if (locale === null) {
      const chosen = i18n.isLocale(req.cookieLang) ? req.cookieLang : i18n.negotiate(req.acceptLanguage);
      if (page) return { kind: "negotiate", location: withQuery(i18n.localePath(chosen, rest || "/"), req.query) };
      // Junk without a language still gets a readable 404, in the language the
      // visitor would have been sent to.
      return { kind: "gone", locale: chosen, location: slug ? placeParam(slug, "host") : null };
    }

    // Every prefixed path on a place's host belongs to that place: `/fr/nope`
    // is that place's 404, not the brand's.
    if (slug) {
      const param = placeParam(slug, "host");
      return page ? { kind: "serve", pathname: `/${locale}/${param}${rest}` } : { kind: "gone", locale, location: param };
    }
    if (page) return { kind: "serve", pathname: req.pathname };
    const [, first = ""] = rest.split("/");
    return { kind: "gone", locale, location: placeSlugs.includes(first) ? first : null };
  }

  return { hostSlug, decide };
}
