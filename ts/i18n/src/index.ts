/**
 * @module @evinvest/i18n
 *
 * Zero-dependency, server-safe core for EV's five-locale internationalisation.
 * No React, no Next.js, no DOM — just the locale registry, the URL contract,
 * Accept-Language negotiation, and a small ICU-subset message formatter over
 * caller-supplied catalogues.
 *
 * **The free functions are the generated registry.** Every surface in the EV
 * workspace shares the same five locales, and having one place they are
 * declared is the point of a shared library — so `localePath`, `negotiate` and
 * the rest are {@link createLocaleRegistry} applied to that generated set
 * ({@link defaultLocaleRegistry}). A surface with its own languages builds its
 * own registry and gets the identical behaviour over its own list. Helpers that
 * iterate locales still take an optional `locales` argument so a surface
 * shipping a subset is not forced to claim all of them.
 *
 * **Formatting numbers and money is deliberately NOT this package's job.** The
 * message formatter supports `plural` and `select` but not `number` or
 * `currency`: consuming apps own one policy per unit of measure (see the
 * cabinet's `shared/lib/money.ts`) and interpolate the already-formatted string.
 * A second, competing number policy hiding inside message catalogues is exactly
 * the drift that rule exists to prevent.
 */

/**
 * The generated locale set — from `ev_lib::i18n::Locale`, which is where the
 * five locales, their endonyms and the default are decided. Plain consts, so
 * this stays zero-dep and server-safe.
 *
 * - `LOCALES` — in the order they are offered to a reader; `en` first because it
 *   is both the default and the authored source. Note `vi` — Vietnamese — is the
 *   ISO 639-1 *language* code. `vn` is the ISO 3166 *country* code for Vietnam
 *   and is not a valid `hreflang` / `lang` value; Google silently discards
 *   invalid values, so the distinction is load-bearing.
 * - `LOCALE_LABELS` — each locale's name **in that locale**, what a language
 *   switcher must show: a reader who cannot read the current language cannot
 *   read "Russian" either. `Locale` derives off it.
 * - `DEFAULT_LOCALE` — the fallback for any reader we cannot place, and the only
 *   locale whose URLs carry no prefix (see {@link localePath}).
 */
export { DEFAULT_LOCALE, LOCALES, LOCALE_LABELS } from "./generated/locales";
export type { Locale } from "./generated/locales";

export { createLocaleRegistry } from "./registry";
export type {
  LangScope,
  LocaleList,
  LocaleRegistry,
  LocaleRegistryConfig,
  Messages,
  Translate,
} from "./registry";
export type { MessageValues } from "./format";

import { DEFAULT_LOCALE, LOCALES, LOCALE_LABELS } from "./generated/locales";
import type { Locale } from "./generated/locales";
import type { MessageValues } from "./format";
import {
  createLocaleRegistry,
  type LangScope,
  type LocaleRegistry,
  type Messages,
  type Translate,
} from "./registry";

/**
 * The generated five-locale registry: default `en`, unprefixed, bare-code
 * `hreflang`. Every free function below delegates to it, and the `./next`,
 * `./react` and `./extract` subpaths use it when no registry is passed.
 */
export const defaultLocaleRegistry: LocaleRegistry<Locale> = createLocaleRegistry({
  locales: LOCALES,
  labels: LOCALE_LABELS,
  default: DEFAULT_LOCALE,
});

const registry = defaultLocaleRegistry;

/**
 * Narrowing guard for untrusted input — a URL segment, a cookie, a query param.
 *
 * @param value - Any value; typically a string of unknown provenance.
 * @returns `true` when `value` is one of {@link LOCALES}.
 *
 * @example
 * ```ts
 * isLocale("ru");  // true
 * isLocale("vn");  // false — country code, not a language code
 * ```
 */
export function isLocale(value: unknown): value is Locale {
  return registry.isLocale(value);
}

// ── URL contract ─────────────────────────────────────────────────────────────
//
// One rule, applied identically by the public site and the cabinet: the default
// locale is unprefixed, every other locale carries a `/<locale>` prefix.
//
//   en → /team          ru → /ru/team
//
// Unprefixed English means no already-indexed URL has to move and no redirect
// sits on the busiest route. The cost is that these two functions are the only
// place that asymmetry may be expressed — hand-built locale URLs elsewhere drift
// immediately.

/**
 * The path a given locale serves `path` at.
 *
 * @param locale - The target locale.
 * @param path   - A root-relative path beginning with `/`.
 * @returns The localised path — unchanged for {@link DEFAULT_LOCALE}, prefixed otherwise.
 *
 * @example
 * ```ts
 * localePath("en", "/team");  // "/team"
 * localePath("ru", "/team");  // "/ru/team"
 * localePath("ru", "/");      // "/ru"
 * ```
 */
export function localePath(locale: Locale, path: string): string {
  return registry.localePath(locale, path);
}

/**
 * The inverse of {@link localePath}: split a request path into its locale and
 * the locale-free path beneath it. An absent or unrecognised prefix reads as
 * {@link DEFAULT_LOCALE}, so this never throws on arbitrary input.
 *
 * @param pathname - A root-relative request path.
 * @returns The detected `locale` and the `path` with any locale prefix removed.
 *
 * @example
 * ```ts
 * splitLocalePath("/ru/team");  // { locale: "ru", path: "/team" }
 * splitLocalePath("/team");     // { locale: "en", path: "/team" }
 * splitLocalePath("/ru");       // { locale: "ru", path: "/" }
 * ```
 */
export function splitLocalePath(pathname: string): { locale: Locale; path: string } {
  return registry.splitLocalePath(pathname);
}

/**
 * Every locale's URL for one page, keyed by locale — the shape `hreflang`
 * clusters and `alternates.languages` both want.
 *
 * @param path    - The locale-free root-relative path.
 * @param locales - Which locales to emit. Defaults to all of {@link LOCALES}.
 * @returns A record from locale to that locale's path for the page.
 *
 * @example
 * ```ts
 * localeAlternates("/team");
 * // { en: "/team", ru: "/ru/team", vi: "/vi/team", fr: "/fr/team", de: "/de/team" }
 * ```
 */
export function localeAlternates(
  path: string,
  locales: readonly Locale[] = LOCALES,
): Record<string, string> {
  return registry.localeAlternates(path, locales);
}

/**
 * The `hreflang` tag a locale is advertised under. The generated registry
 * targets languages, not regions, so this is the bare code.
 */
export function hreflangOf(locale: Locale): string {
  return registry.hreflangOf(locale);
}

/**
 * Absolute URLs for one page keyed by `hreflang`, plus `x-default` pointing at
 * {@link DEFAULT_LOCALE} when `locales` includes it — ready for
 * `alternates.languages` in Next's `generateMetadata`. Every URL is absolute:
 * Google ignores relative `hreflang`.
 *
 * @param path    - The locale-free root-relative path, e.g. `/team`.
 * @param siteUrl - Absolute origin; a trailing slash is tolerated.
 * @param locales - Locales to advertise. Defaults to all of {@link LOCALES}.
 *
 * @example
 * ```ts
 * languageAlternates("/team", "https://evinvest.ltd");
 * // { en: "https://evinvest.ltd/team", ru: "https://evinvest.ltd/ru/team", …,
 * //   "x-default": "https://evinvest.ltd/team" }
 * ```
 */
export function languageAlternates(
  path: string,
  siteUrl: string,
  locales: readonly Locale[] = LOCALES,
): Record<string, string> {
  return registry.languageAlternates(path, siteUrl, locales);
}

/**
 * Pick the best locale for an `Accept-Language` header, honouring q-values and
 * matching a bare language against a regional tag (`ru-RU` → `ru`).
 *
 * Note what this is *for*. EV serves the default locale at unprefixed URLs and
 * never auto-redirects on it — Google crawls in English from a US IP, so a
 * language redirect can bury the other locales, and a reader who deliberately
 * chose English should not be bounced out of it. Use this to decide which
 * locale to *suggest* (the "read this in your language" strip), not to decide
 * what to serve.
 *
 * @param header  - A raw `Accept-Language` value, or `null`/`undefined` when absent.
 * @param locales - Candidate locales. Defaults to all of {@link LOCALES}.
 * @returns The best-matching locale, or {@link DEFAULT_LOCALE} when nothing matches.
 *
 * @example
 * ```ts
 * negotiate("ru-RU,ru;q=0.9,en;q=0.8");  // "ru"
 * negotiate("ja,ko;q=0.8");              // "en" — no match, fall back
 * negotiate(null);                        // "en"
 * ```
 */
export function negotiate(
  header: string | null | undefined,
  locales: readonly Locale[] = LOCALES,
): Locale {
  return registry.negotiate(header, locales);
}

// ── Messages ─────────────────────────────────────────────────────────────────

/**
 * Build a {@link Translate} bound to one catalogue and locale.
 *
 * English is authored at the call site and the catalogue is generated back out
 * of the code (`evinvest-i18n-extract`), so the catalogue is a build artefact
 * and `en` is the source. Two consequences the signature makes unavoidable:
 * copy cannot be edited in one place and read from another, and a key the
 * catalogue lacks renders the sentence the component asked for rather than a
 * dotted key.
 *
 * For {@link DEFAULT_LOCALE} the catalogue is never consulted — there is
 * nothing left to look up.
 *
 * @param messages - The catalogue for `locale`.
 * @param locale   - The locale, used for plural rules.
 * @param onMissing - Fired for a key the catalogue has never heard of, which
 *   means the extractor was not re-run. Wire it to Sentry in production.
 * @returns A translate function.
 *
 * @example
 * ```ts
 * const t = translator({ "cart.items": "{n, plural, one {# товар} few {# товара} many {# товаров}}" }, "ru");
 * t("cart.items", "{n, plural, one {# item} other {# items}}", { n: 2 });  // "2 товара"
 * t("nope", "Fallback copy");                                             // "Fallback copy"
 * ```
 */
export function translator(
  messages: Messages,
  locale: Locale,
  onMissing?: (key: string, locale: Locale) => void,
): Translate {
  return registry.translator(messages, locale, onMissing);
}

/**
 * The locale a DOM subtree is written in, per `lang` inheritance.
 *
 * This is how an element remote — a custom element the host composes into its
 * own page — learns what language to render in. Not a prop and not an
 * attribute: a host mounts the element before it applies attributes, so
 * anything pushed in reads as `null` at `connectedCallback` time. `lang` is the
 * platform's own answer to "what language is this subtree", it is already set
 * correctly by every host that serves more than one, and it is readable the
 * instant the node is attached.
 *
 * A regional tag resolves to its base language (`ru-RU` → `ru`); an absent or
 * unpublished `lang` reads as {@link DEFAULT_LOCALE}.
 */
export function localeOfElement(node: LangScope): Locale {
  return registry.localeOfElement(node);
}

/**
 * Format one ICU-subset pattern.
 *
 * Supported: `{name}` interpolation, `{n, plural, …}` (with `=N` exact matches
 * and `#` for the count), `{k, select, …}`, and `'` escaping for literal braces.
 * Not supported, on purpose: `number`, `date`, `currency` and `plural` offsets —
 * see the module note on why formatting policy stays in the consuming app.
 *
 * Malformed patterns degrade to the text as written rather than throwing; a
 * copy typo should not take a page down.
 *
 * @param pattern - The message pattern.
 * @param locale  - Locale, used to resolve plural categories.
 * @param values  - Interpolation values.
 * @returns The formatted string.
 */
export function formatMessage(
  pattern: string,
  locale: Locale,
  values: MessageValues = {},
): string {
  return registry.formatMessage(pattern, locale, values);
}
