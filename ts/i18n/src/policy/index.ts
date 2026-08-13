/**
 * @module @evinvest/i18n/policy
 *
 * EV's translation policy, enforced in code rather than in review.
 *
 * **1.1 — English is canonical.** `en` is the authored source. It defines the
 * key set, the placeholders, and the meaning. Every other locale is a
 * *derivation* of it, and nothing else may introduce a key.
 *
 * **1.2 — A translation that no longer matches its English source is not used.**
 * The English string is served instead. This is the rule that keeps a stale
 * translation from quietly contradicting the site: when English copy changes and
 * the translation does not, the translation is no longer a translation of
 * anything — it is last quarter's claim, in another language, presented as
 * current.
 *
 * **1.3 — Compiled content with no translation for the current locale is
 * hidden, not silently served in English.** See {@link availableIn}.
 *
 * ## What "semantic comparison" can and cannot mean in code
 *
 * Nothing here compares *meaning* across languages — no program does that
 * reliably, and one that claimed to would fail silently, which is worse than not
 * trying. What is mechanically checkable is **provenance** and **structure**,
 * and together they catch the failure that actually happens in practice:
 *
 * - **Provenance.** Each translated entry records the English text it was
 *   written against. If today's English differs, the translation is stale by
 *   construction — no judgement required, and the diff shows a reviewer exactly
 *   what changed underneath it.
 * - **Structure.** The set of placeholders, their argument types, and the plural
 *   categories a locale requires must all match. A Russian string that handles
 *   only `one`/`other` is *provably* not equivalent to an English plural, because
 *   Russian needs `few` and `many` too — that one is caught arithmetically, not
 *   by opinion.
 *
 * A translation can still be a bad translation of the right source. That is a
 * job for a human reviewer, and this module deliberately does not pretend
 * otherwise.
 */

import { DEFAULT_LOCALE, type Locale, type Messages } from "../index.js";

/**
 * One translated entry: the text, plus the English it was translated from.
 *
 * `en` is stored as the source *text* rather than a hash on purpose. A hash
 * would be shorter and equally correct, but a reviewer reading a pull request
 * could not see what the translator was looking at. With the text inline, a
 * drifted entry is self-evident in the diff.
 */
export interface TranslatedEntry {
  /** The English source this was translated from. */
  en: string;
  /** The translation. */
  t: string;
}

/** A non-English catalogue as authored on disk. */
export type TranslatedCatalogue = Readonly<Record<string, TranslatedEntry>>;

/** Why a translated entry was refused, and English used instead. */
export type RejectionReason =
  /** Today's English differs from the `en` the translation was written against. */
  | "source-drift"
  /** The translation interpolates a different set of placeholders. */
  | "placeholder-mismatch"
  /** An argument is a plural/select in one language and not the other. */
  | "argument-type-mismatch"
  /** A plural is missing a category this locale requires (ru needs few/many). */
  | "plural-category-missing"
  /** A key English does not define — rule 1.1: only English introduces keys. */
  | "orphan-key"
  /** Blank translation. */
  | "empty";

/** One refusal, with enough detail to fix it without opening the catalogue. */
export interface Rejection {
  key: string;
  reason: RejectionReason;
  detail: string;
}

/** The outcome of applying the policy to one locale's catalogue. */
export interface ResolvedCatalogue {
  locale: Locale;
  /** Ready for `translator()`: accepted translations, English everywhere else. */
  messages: Messages;
  /** Entries refused by rule 1.2, each falling back to English. */
  rejected: Rejection[];
  /** Keys English defines that this locale has not translated at all. */
  missing: string[];
  /** Share of English keys actually served in this locale, 0–1. */
  coverage: number;
}

/**
 * Apply rules 1.1 and 1.2 to one locale's catalogue.
 *
 * Never throws and never returns a hole: every key English defines is present in
 * `messages`, served in the target locale when the translation passes and in
 * English when it does not. A page therefore cannot break because a translation
 * went stale — it degrades to canonical English, which is rule 1.2's entire
 * point.
 *
 * @param locale     - The locale being resolved. `en` returns `source` unchanged.
 * @param source     - The English catalogue. Canonical: it defines the key set.
 * @param translated - The locale's authored catalogue.
 * @returns The resolved catalogue plus a full account of what was refused.
 *
 * @example
 * ```ts
 * const { messages, rejected } = resolveCatalogue("ru", en, ru);
 * const t = translator(messages, "ru");
 * // rejected: [{ key: "hero.title", reason: "source-drift", detail: … }]
 * ```
 */
export function resolveCatalogue(
  locale: Locale,
  source: Messages,
  translated: TranslatedCatalogue,
): ResolvedCatalogue {
  if (locale === DEFAULT_LOCALE) {
    return { locale, messages: source, rejected: [], missing: [], coverage: 1 };
  }

  const messages: Record<string, string> = {};
  const rejected: Rejection[] = [];
  const missing: string[] = [];
  let accepted = 0;

  // Rule 1.1 — English defines the key set, so a key only this locale has is a
  // key nothing renders. Reported rather than ignored: it is usually a rename
  // that left the translation behind.
  for (const key of Object.keys(translated)) {
    if (!(key in source)) {
      rejected.push({
        key,
        reason: "orphan-key",
        detail: `not defined in ${DEFAULT_LOCALE} — only the canonical locale introduces keys`,
      });
    }
  }

  for (const [key, en] of Object.entries(source)) {
    const entry = translated[key];
    if (entry === undefined) {
      missing.push(key);
      messages[key] = en;
      continue;
    }

    const problem = check(entry, en, locale);
    if (problem !== null) {
      rejected.push({ key, ...problem });
      messages[key] = en;
      continue;
    }

    messages[key] = entry.t;
    accepted += 1;
  }

  const total = Object.keys(source).length;
  return {
    locale,
    messages,
    rejected,
    missing,
    coverage: total === 0 ? 1 : accepted / total,
  };
}

/** The whole of rule 1.2 for a single entry. `null` means accepted. */
function check(
  entry: TranslatedEntry,
  en: string,
  locale: Locale,
): Omit<Rejection, "key"> | null {
  if (entry.t.trim() === "") {
    return { reason: "empty", detail: "translation is blank" };
  }

  // Provenance. The one check that catches ordinary drift: English moved, the
  // translation did not.
  if (entry.en !== en) {
    return {
      reason: "source-drift",
      detail: `translated from ${JSON.stringify(entry.en)}, source is now ${JSON.stringify(en)}`,
    };
  }

  const sourceArgs = scanArguments(en);
  const targetArgs = scanArguments(entry.t);

  for (const [name, kind] of sourceArgs) {
    const mirrored = targetArgs.get(name);
    if (mirrored === undefined) {
      return {
        reason: "placeholder-mismatch",
        detail: `source interpolates {${name}}, translation does not`,
      };
    }
    if (mirrored.type !== kind.type) {
      return {
        reason: "argument-type-mismatch",
        detail: `{${name}} is a ${kind.type} in ${DEFAULT_LOCALE} and a ${mirrored.type} here`,
      };
    }
    if (kind.type === "plural") {
      // The arithmetic half of "semantically equal". English has two plural
      // categories; Russian has four. A translation that only mirrors English's
      // branches is missing cases that will be hit by real numbers.
      const required = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
      const absent = required.filter(
        category => !mirrored.branches.has(category) && !mirrored.branches.has("other"),
      );
      if (absent.length > 0) {
        return {
          reason: "plural-category-missing",
          detail: `{${name}} needs ${absent.join(", ")} in ${locale}`,
        };
      }
    }
  }

  for (const name of targetArgs.keys()) {
    if (!sourceArgs.has(name)) {
      return {
        reason: "placeholder-mismatch",
        detail: `translation interpolates {${name}}, which the source does not provide`,
      };
    }
  }

  return null;
}

interface ArgumentShape {
  type: "value" | "plural" | "select";
  branches: Set<string>;
}

/**
 * Extract each argument's name, type, and (for plural/select) branch keys.
 *
 * Deliberately independent of the formatter in `../index.ts`: this needs only
 * the shape of the arguments, never their rendered output, and keeping the two
 * separate means the policy module carries no formatting behaviour it would then
 * have to keep in sync.
 */
function scanArguments(pattern: string): Map<string, ArgumentShape> {
  const found = new Map<string, ArgumentShape>();

  const walk = (text: string): void => {
    let i = 0;
    while (i < text.length) {
      const ch = text[i];

      // Mirror the formatter's ICU 4.8 quoting so an escaped '{' is not read as
      // an argument — otherwise "it's '{not}' a placeholder" trips the checker.
      if (ch === "'") {
        const next = text[i + 1];
        if (next === "'") {
          i += 2;
          continue;
        }
        if (next === "{" || next === "}" || next === "#") {
          i += 2;
          while (i < text.length && text[i] !== "'") i += 1;
          i += 1;
          continue;
        }
        i += 1;
        continue;
      }

      if (ch !== "{") {
        i += 1;
        continue;
      }

      const end = closing(text, i);
      if (end === -1) return;
      const inner = text.slice(i + 1, end);
      i = end + 1;

      const firstComma = topLevel(inner, ",");
      if (firstComma === -1) {
        const name = inner.trim();
        if (name !== "" && !found.has(name)) {
          found.set(name, { type: "value", branches: new Set() });
        }
        continue;
      }

      const name = inner.slice(0, firstComma).trim();
      const rest = inner.slice(firstComma + 1);
      const secondComma = topLevel(rest, ",");
      const declared = (secondComma === -1 ? rest : rest.slice(0, secondComma)).trim();
      const body = secondComma === -1 ? "" : rest.slice(secondComma + 1);
      const type =
        declared === "plural" || declared === "select" ? (declared as "plural" | "select") : "value";

      const branches = new Set<string>();
      if (type !== "value") {
        for (const [branchKey, branchBody] of branchesOf(body)) {
          branches.add(branchKey);
          walk(branchBody);
        }
      }
      if (name !== "") found.set(name, { type, branches });
    }
  };

  walk(pattern);
  return found;
}

function closing(source: string, start: number): number {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function topLevel(source: string, sep: string): number {
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === sep && depth === 0) return i;
  }
  return -1;
}

function branchesOf(body: string): [string, string][] {
  const out: [string, string][] = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i] ?? "")) i += 1;
    const keyStart = i;
    while (i < body.length && !/[\s{]/.test(body[i] ?? "")) i += 1;
    const key = body.slice(keyStart, i);
    while (i < body.length && /\s/.test(body[i] ?? "")) i += 1;
    if (body[i] !== "{") break;
    const end = closing(body, i);
    if (end === -1) break;
    if (key !== "") out.push([key, body.slice(i + 1, end)]);
    i = end + 1;
  }
  return out;
}

/**
 * Render resolved catalogues as a report for a CI check.
 *
 * The runtime already degrades safely — rule 1.2 serves English and the page is
 * fine. That safety is exactly why drift needs a *second*, noisy channel: a
 * silent fallback looks identical to a site that was never translated, so
 * without this a locale can rot to zero coverage without anyone noticing.
 *
 * @param resolved - One entry per non-default locale.
 * @param floor    - Minimum acceptable coverage, 0–1. Defaults to 1 (no drift).
 * @returns `ok` plus a human-readable report.
 *
 * @example
 * ```ts
 * const { ok, report } = auditCatalogues(locales.map(l => resolveCatalogue(l, en, load(l))));
 * console.log(report);
 * process.exit(ok ? 0 : 1);
 * ```
 */
export function auditCatalogues(
  resolved: readonly ResolvedCatalogue[],
  floor = 1,
): { ok: boolean; report: string } {
  const lines: string[] = [];
  let ok = true;

  for (const cat of resolved) {
    const pct = Math.round(cat.coverage * 100);
    const healthy = cat.rejected.length === 0 && cat.coverage >= floor;
    if (!healthy) ok = false;
    lines.push(`${healthy ? "ok  " : "FAIL"} ${cat.locale}  ${pct}% coverage`);

    for (const r of cat.rejected) {
      lines.push(`       ${r.key}  [${r.reason}] ${r.detail}`);
    }
    // Missing keys are listed but capped: a locale that has translated nothing
    // yet would otherwise bury the drift that actually needs fixing.
    if (cat.missing.length > 0) {
      const shown = cat.missing.slice(0, 10);
      lines.push(`       untranslated (${cat.missing.length}): ${shown.join(", ")}`);
      if (cat.missing.length > shown.length) {
        lines.push(`       …and ${cat.missing.length - shown.length} more`);
      }
    }
  }

  return { ok, report: lines.join("\n") };
}

// ── Rule 1.3 — content ───────────────────────────────────────────────────────

/**
 * What to do with a content item that has no translation for the current locale.
 *
 * `"hide"` is the policy for *compiled* content — publications, the whitepaper,
 * anything built once and surfaced everywhere. A Russian reader given an English
 * essay under Russian chrome learns that the locale is a veneer.
 *
 * `"fallback"` exists because the rule is not universally right, and pretending
 * otherwise would be the bug. A vacancy is the clear case: hiding an open role
 * from a Russian speaker who reads English fine costs a candidate, and loses more
 * than the inconsistency costs. Choose per collection, deliberately.
 */
export type MissingContentPolicy = "hide" | "fallback";

/**
 * Apply rule 1.3 to a content collection.
 *
 * @param locale    - The reader's locale.
 * @param items     - The full collection, in canonical (English) form.
 * @param localesOf - Which locales a given item has been translated into.
 * @param policy    - `"hide"` (default) or `"fallback"`.
 * @returns The items this locale should see.
 *
 * @example
 * ```ts
 * // Publications: hide what is not translated.
 * availableIn("ru", allPublications(), p => p.locales);
 *
 * // Vacancies: an open role is worth more than a consistent language.
 * availableIn("ru", vacancies, v => v.locales, "fallback");
 * ```
 */
export function availableIn<T>(
  locale: Locale,
  items: readonly T[],
  localesOf: (item: T) => readonly Locale[] | undefined,
  policy: MissingContentPolicy = "hide",
): T[] {
  if (locale === DEFAULT_LOCALE || policy === "fallback") return [...items];
  return items.filter(item => (localesOf(item) ?? []).includes(locale));
}
