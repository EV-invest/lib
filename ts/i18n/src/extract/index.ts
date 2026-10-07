/**
 * @module @evinvest/i18n/extract
 *
 * Reads every `t(key, en)` out of a source tree and writes the English
 * catalogue back out of it.
 *
 * English is authored where it is rendered — `t("hero.title", "We build …")` —
 * so `messages/en/common.json` is a build artefact, not a source. That inverts
 * the old failure mode: copy can no longer be edited in one place and read from
 * another, and a key nothing calls stops being carried (and retranslated)
 * forever. What it cannot do is notice a *deleted* call site, which is why
 * {@link writeCatalogues} prunes unconditionally rather than additively.
 *
 * Syntactic only — `ts.createSourceFile`, no program, no type checker. Every
 * `t` in an app is the same `t`, so a name match is enough, and a full program
 * would cost seconds per run for nothing. `typescript` is an optional peer
 * dependency: it is needed to run the extractor, never to render a string.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  defaultLocaleRegistry,
  type Locale,
  type LocaleRegistry,
  type Messages,
} from "../index.js";
import { auditCatalogues, createPolicy, type TranslatedCatalogue } from "../policy/index.js";
import {
  callsIn,
  DEFAULT_EXCLUDE,
  dedupe,
  flag,
  list,
  parse,
  serialise,
  sourceFiles,
  type Entry,
  type Extraction,
} from "./calls.js";

export { DEFAULT_EXCLUDE } from "./calls.js";
export type { Entry, Extraction } from "./calls.js";

/** Where to look, and what not to look at. */
export interface ExtractOptions {
  /** Directory to scan, recursively. */
  root: string;
  /**
   * Directory and file names to skip, at any depth.
   *
   * What is NOT source, rather than what is. A list of source *directories* is
   * a hole that opens the day someone adds a slice, and an unscanned call site
   * produces no error — just English forever in five locales. Dot-prefixed
   * names are always skipped; {@link DEFAULT_EXCLUDE} covers what every app has.
   */
  exclude?: readonly string[];
}

/**
 * Every `t(key, en)` under `root`, plus the call sites that cannot be read.
 *
 * A call that cannot be read statically is an error, not a skip: the point of
 * inlining is that the copy is visible where it renders, and a key assembled at
 * runtime is neither visible nor greppable. Two call sites sharing a key with
 * different English is the same class of error — the catalogue can only hold
 * one of them, so which one ships would be decided by file order.
 */
export function collect({ root, exclude = DEFAULT_EXCLUDE }: ExtractOptions): Extraction {
  const skip = new Set([...DEFAULT_EXCLUDE, ...exclude]);
  const entries: Entry[] = [];
  const errors: string[] = [];

  for (const path of sourceFiles(root, skip, "")) {
    const found = callsIn(path, parse(path, readFileSync(join(root, path), "utf8")));
    entries.push(...found.entries);
    errors.push(...found.errors);
  }

  const unique = dedupe(entries);
  return { entries: unique.entries, errors: [...errors, ...unique.errors] };
}

/** Sorted, so the generated file diffs by key rather than by call-site order. */
export function catalogue(entries: readonly Entry[]): Record<string, string> {
  return Object.fromEntries(
    entries.map(e => [e.key, e.en] as const).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}

export { serialise } from "./calls.js";

/** `<messages>/<locale>/common.json`. One layout, shared by every EV surface. */
export const cataloguePath = (messages: string, locale: string): string =>
  join(messages, locale, "common.json");

/**
 * The slice of a locale registry the extractor reads: which catalogues exist,
 * and which one is the source. Every function here defaults it to the generated
 * registry; pass your own `createLocaleRegistry` result to extract for another
 * locale set.
 */
export type CatalogueLocales<L extends string = string> = Pick<
  LocaleRegistry<L>,
  "locales" | "defaultLocale"
>;

/** The non-default locales that have an authored catalogue on disk. */
export function translatedLocales(messages: string): Locale[];
export function translatedLocales<L extends string>(
  messages: string,
  registry: CatalogueLocales<L>,
): L[];
export function translatedLocales(
  messages: string,
  registry: CatalogueLocales = defaultLocaleRegistry,
): string[] {
  const present = new Set(
    readdirSync(messages, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name),
  );
  return registry.locales.filter(l => l !== registry.defaultLocale && present.has(l));
}

/**
 * Write the source catalogue, and prune every translated one down to the keys
 * the code still asks for.
 *
 * @returns A line per catalogue, for the caller to print.
 */
export function writeCatalogues(
  messages: string,
  entries: readonly Entry[],
  registry: CatalogueLocales = defaultLocaleRegistry,
): string[] {
  const en = catalogue(entries);
  writeFileSync(cataloguePath(messages, registry.defaultLocale), serialise(en));
  const lines = [
    `${registry.defaultLocale}: ${Object.keys(en).length} keys from ${entries.length} call sites`,
  ];

  for (const locale of translatedLocales(messages, registry)) {
    const path = cataloguePath(messages, locale);
    const authored = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    const kept = Object.fromEntries(Object.entries(authored).filter(([key]) => key in en));
    const dropped = Object.keys(authored).length - Object.keys(kept).length;
    writeFileSync(path, serialise(kept));
    lines.push(
      `${locale}: ${Object.keys(kept).length} kept, ${dropped} orphan${dropped === 1 ? "" : "s"} dropped`,
    );
  }
  return lines;
}

// ── The two bins ─────────────────────────────────────────────────────────────
//
// `cli/*.mjs` are three-line launchers around these. The argument shapes are
// identical, so a check and the extract that fixes it can never be pointed at
// different trees.

/** `--root x --messages y --exclude a,b`; `--root` defaults to the working directory. */
function parseArgs(argv: readonly string[]): ExtractOptions & { messages: string } {
  const root = flag(argv, "root") ?? process.cwd();
  return {
    root,
    messages: flag(argv, "messages") ?? join(root, "messages"),
    exclude: list(flag(argv, "exclude")),
  };
}

function read(argv: readonly string[]): { messages: string; entries: Entry[] } {
  const { messages, ...options } = parseArgs(argv);
  const { entries, errors } = collect(options);
  if (errors.length === 0) return { messages, entries };

  console.error(`${errors.length} t() call site${errors.length === 1 ? "" : "s"} the extractor cannot read:\n`);
  for (const error of errors) console.error(`  ${error}`);
  console.error(
    "\nEvery t() takes a literal key and a literal English string. Restructure the" +
      " call — a runtime-assembled key has nowhere to put its copy.",
  );
  process.exit(1);
}

/**
 * `evinvest-i18n-extract` — regenerate English from the code, prune the rest to match.
 *
 * @param registry - Whose locales to write. The bin uses the generated registry;
 *   a surface with its own set calls this from a launcher of its own.
 */
export function runExtract(
  argv: readonly string[],
  registry: CatalogueLocales = defaultLocaleRegistry,
): void {
  const { messages, entries } = read(argv);
  for (const line of writeCatalogues(messages, entries, registry)) console.log(line);
}

/**
 * `evinvest-i18n-check` — the CI gate for the policy, and for the generation
 * half above it.
 *
 * The runtime already degrades safely: a drifted entry falls back to canonical
 * English and the page is fine. That safety is exactly why this exists. A silent
 * fallback is indistinguishable from a surface that was never translated, so
 * without a noisy second channel a locale can rot to zero coverage and nobody
 * finds out until a reader mentions it.
 *
 * Fatal: a committed English catalogue that no longer matches the code (it would
 * hand `resolveCatalogue` a stale source to compare every translation against),
 * and drift. Reported but not fatal: untranslated keys — a locale is filled in
 * over time, and blocking CI on an unfinished translation would just get the
 * check disabled.
 *
 * @param registry - Whose locales to check; see {@link runExtract}.
 */
export function runCheck(
  argv: readonly string[],
  registry: CatalogueLocales = defaultLocaleRegistry,
): void {
  const { messages, entries } = read(argv);

  const generated = serialise(catalogue(entries));
  const enPath = cataloguePath(messages, registry.defaultLocale);
  if (generated !== readFileSync(enPath, "utf8")) {
    console.error(`${enPath} is out of date with the code. Run \`evinvest-i18n-extract\`.`);
    process.exit(1);
  }

  const en = JSON.parse(generated) as Messages;
  const { resolveCatalogue } = createPolicy(registry);
  const resolved = translatedLocales(messages, registry).map(locale =>
    resolveCatalogue(
      locale,
      en,
      JSON.parse(readFileSync(cataloguePath(messages, locale), "utf8")) as TranslatedCatalogue,
    ),
  );
  console.log(auditCatalogues(resolved, 0).report);

  const drifted = resolved.flatMap(c => c.rejected.map(r => `${c.locale}/${r.key}: ${r.reason} — ${r.detail}`));
  if (drifted.length > 0) {
    console.error(`\n${drifted.length} entr${drifted.length === 1 ? "y" : "ies"} rejected by policy:`);
    for (const line of drifted) console.error(`  ${line}`);
    console.error(
      "\nEnglish is being served for these. Retranslate and update the `en` field," +
        " or revert the English change.",
    );
    process.exit(1);
  }

  console.log("\ni18n: no drift — every translation matches its English source");
}
