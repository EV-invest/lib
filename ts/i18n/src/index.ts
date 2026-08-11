/**
 * @module @evinvest/i18n
 *
 * Zero-dependency, server-safe core for EV's five-locale internationalisation.
 * No React, no Next.js, no DOM — just the locale registry, the URL contract,
 * Accept-Language negotiation, and a small ICU-subset message formatter over
 * caller-supplied catalogues.
 *
 * **Why this hard-codes its locales, unlike `@evinvest/experiments`.** That
 * package deliberately never hard-codes experiment keys, because experiments are
 * per-app. Locales are the opposite: the same five apply to the public site, the
 * cabinet, and every MFE, and having one place they are declared is the entire
 * point of putting this in a shared library. Helpers that iterate locales still
 * take an optional `locales` argument so a surface shipping a subset (an MFE
 * translated into two languages, say) is not forced to claim all five.
 *
 * **Formatting numbers and money is deliberately NOT this package's job.** The
 * message formatter supports `plural` and `select` but not `number` or
 * `currency`: consuming apps own one policy per unit of measure (see the
 * cabinet's `shared/lib/money.ts`) and interpolate the already-formatted string.
 * A second, competing number policy hiding inside message catalogues is exactly
 * the drift that rule exists to prevent.
 */

/**
 * The locales EV publishes, in the order they are offered to a reader.
 * `en` is first because it is both the default and the authored source.
 *
 * Note `vi` — Vietnamese — is the ISO 639-1 *language* code. `vn` is the ISO
 * 3166 *country* code for Vietnam and is not a valid `hreflang` / `lang` value;
 * Google silently discards invalid values, so the distinction is load-bearing.
 */
export const LOCALES = ["en", "ru", "vi", "fr", "de"] as const;

/** One of the five locales EV publishes. */
export type Locale = (typeof LOCALES)[number];

/**
 * The authored source locale, and the fallback for any reader we cannot place.
 * Also the only locale whose URLs carry no prefix — see {@link localePath}.
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Each locale's name **in that locale** — what a language switcher must show.
 * A reader who cannot read the current language cannot read "Russian" either,
 * so a switcher that localises its own option labels is unusable to the very
 * person reaching for it.
 */
export const LOCALE_LABELS: Readonly<Record<Locale, string>> = {
  en: "English",
  ru: "Русский",
  vi: "Tiếng Việt",
  fr: "Français",
  de: "Deutsch",
};

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
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
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
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  // "/" would otherwise yield "/ru/", and a trailing slash is a distinct URL to
  // a crawler — one canonical shape per page, so strip it.
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
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
  const clean = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const slash = clean.indexOf("/", 1);
  const head = slash === -1 ? clean.slice(1) : clean.slice(1, slash);
  if (!isLocale(head) || head === DEFAULT_LOCALE) return { locale: DEFAULT_LOCALE, path: clean };
  const rest = slash === -1 ? "/" : clean.slice(slash);
  return { locale: head, path: rest === "" ? "/" : rest };
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
  return Object.fromEntries(locales.map(l => [l, localePath(l, path)]));
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
  if (!header) return DEFAULT_LOCALE;

  const ranked = header
    .split(",")
    .map(part => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map(p => p.trim())
        .find(p => p.startsWith("q="))
        ?.slice(2);
      const quality = q === undefined ? 1 : Number.parseFloat(q);
      return {
        tag: (tag ?? "").trim().toLowerCase(),
        // A malformed q= sorts last rather than poisoning the comparison with NaN.
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    // q=0 is an explicit refusal of that language, not a weak preference.
    .filter(entry => entry.tag !== "" && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    // "ru-RU" and "ru" both match the "ru" catalogue; "*" means "anything", for
    // which the default is as good an answer as any.
    const base = tag.split("-")[0] ?? "";
    const hit = locales.find(l => l === tag || l === base);
    if (hit) return hit;
    if (tag === "*") return DEFAULT_LOCALE;
  }
  return DEFAULT_LOCALE;
}

// ── Messages ─────────────────────────────────────────────────────────────────

/**
 * A loaded catalogue: flat `key → pattern`. Flat rather than nested because the
 * drift checker diffs, hashes, and reports per fully-qualified key, and a nested
 * shape would make every one of those operations a tree walk for no gain at the
 * call site (`t("hero.title")` reads the same either way).
 */
export type Messages = Readonly<Record<string, string>>;

/** Values interpolated into a message pattern. */
export type MessageValues = Readonly<Record<string, string | number>>;

/** Looks up `key`, formats it against `values`, and returns display text. */
export type Translate = (key: string, values?: MessageValues) => string;

/**
 * Build a {@link Translate} bound to one catalogue and locale.
 *
 * A missing key returns the key itself. That is deliberate: a blank or throwing
 * lookup turns a translation gap into either an invisible hole or a white
 * screen, whereas the raw key is self-describing on screen, greppable, and
 * survives to a screenshot in a bug report. The build-time checker is what
 * *finds* missing keys — the runtime's job is only to degrade legibly.
 *
 * @param messages - The catalogue for `locale`.
 * @param locale   - The locale, used for plural rules.
 * @param onMissing - Optional hook fired on a missing key (wire it to Sentry in production).
 * @returns A translate function.
 *
 * @example
 * ```ts
 * const t = translator({ "cart.items": "{n, plural, one {# item} other {# items}}" }, "en");
 * t("cart.items", { n: 1 });  // "1 item"
 * t("cart.items", { n: 5 });  // "5 items"
 * t("nope");                  // "nope"
 * ```
 */
export function translator(
  messages: Messages,
  locale: Locale,
  onMissing?: (key: string, locale: Locale) => void,
): Translate {
  return (key, values) => {
    const pattern = messages[key];
    if (pattern === undefined) {
      onMissing?.(key, locale);
      return key;
    }
    return formatMessage(pattern, locale, values);
  };
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
  return format(pattern, locale, values, undefined);
}

/**
 * The formatter proper. `pound` is the already-formatted count when rendering
 * inside a plural branch, and `undefined` everywhere else — threading it through
 * (rather than string-replacing `#` afterwards) is what lets `'#'` stay escapable
 * and keeps `#` literal outside a plural, as ICU specifies.
 */
function format(
  pattern: string,
  locale: Locale,
  values: MessageValues,
  pound: string | undefined,
): string {
  let out = "";
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    // ICU's apostrophe-friendly quoting (the ICU 4.8+ rules every modern
    // toolchain implements): an apostrophe only starts a quoted section when it
    // immediately precedes a syntax character, and that section runs to the next
    // apostrophe. Anywhere else it is a plain apostrophe — which matters, since
    // English marketing copy is full of them and the naive "quote escapes the
    // next character" reading mangles every "we've" and "don't".
    if (ch === "'") {
      const next = pattern[i + 1];
      if (next === "'") {
        out += "'";
        i += 2;
        continue;
      }
      if (next === "{" || next === "}" || next === "#") {
        i += 1;
        while (i < pattern.length) {
          if (pattern[i] === "'") {
            if (pattern[i + 1] === "'") {
              out += "'";
              i += 2;
              continue;
            }
            i += 1;
            break;
          }
          out += pattern[i];
          i += 1;
        }
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }

    if (ch === "#" && pound !== undefined) {
      out += pound;
      i += 1;
      continue;
    }

    if (ch === "{") {
      const end = matchBrace(pattern, i);
      if (end === -1) {
        // Unbalanced — emit the rest verbatim rather than losing the copy.
        out += pattern.slice(i);
        break;
      }
      out += renderArgument(pattern.slice(i + 1, end), locale, values, pound);
      i = end + 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/** Index of the `}` closing the `{` at `start`, or -1 if unbalanced. */
function matchBrace(source: string, start: number): number {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Index of the first `sep` not nested inside braces, or -1. */
function topLevelIndexOf(source: string, sep: string): number {
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === sep && depth === 0) return i;
  }
  return -1;
}

function renderArgument(
  inner: string,
  locale: Locale,
  values: MessageValues,
  pound: string | undefined,
): string {
  const firstComma = topLevelIndexOf(inner, ",");

  // `{name}` — plain interpolation.
  if (firstComma === -1) {
    const value = values[inner.trim()];
    return value === undefined ? `{${inner}}` : String(value);
  }

  const name = inner.slice(0, firstComma).trim();
  const rest = inner.slice(firstComma + 1);
  const secondComma = topLevelIndexOf(rest, ",");
  const type = (secondComma === -1 ? rest : rest.slice(0, secondComma)).trim();
  const body = secondComma === -1 ? "" : rest.slice(secondComma + 1);
  const raw = values[name];

  if (type === "plural") {
    const count = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(count)) return "";
    const branches = parseBranches(body);
    const exact = branches.get(`=${count}`);
    const category = new Intl.PluralRules(locale).select(count);
    const chosen = exact ?? branches.get(category) ?? branches.get("other");
    if (chosen === undefined) return "";
    // `#` is the count in the reader's locale — ru groups with spaces, de with
    // dots.
    return format(chosen, locale, values, new Intl.NumberFormat(locale).format(count));
  }

  if (type === "select") {
    const branches = parseBranches(body);
    const chosen = branches.get(String(raw)) ?? branches.get("other");
    // `pound` flows through: a select nested inside a plural keeps `#` bound to
    // the enclosing count, per ICU.
    return chosen === undefined ? "" : format(chosen, locale, values, pound);
  }

  // Unknown argument type — fall back to interpolation so the copy still reads.
  return raw === undefined ? `{${inner}}` : String(raw);
}

/** Parse `key {body} key {body}` branch lists into a map. */
function parseBranches(body: string): Map<string, string> {
  const branches = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i] ?? "")) i += 1;
    const keyStart = i;
    while (i < body.length && !/[\s{]/.test(body[i] ?? "")) i += 1;
    const key = body.slice(keyStart, i);
    while (i < body.length && /\s/.test(body[i] ?? "")) i += 1;
    if (body[i] !== "{") break;
    const end = matchBrace(body, i);
    if (end === -1) break;
    if (key !== "") branches.set(key, body.slice(i + 1, end));
    i = end + 1;
  }
  return branches;
}
