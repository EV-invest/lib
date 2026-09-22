import { references, type Contract } from "./contract";
import { parseToml, type TomlTable, type TomlValue } from "./toml";

export type PolarityName = "light" | "dark";
export const POLARITIES: readonly PolarityName[] = ["light", "dark"];

/** A brand's palette: one value per contract name, for each polarity. */
export interface BrandConfig {
  colors: Record<PolarityName, Record<string, string>>;
  /** `--brand-mark`: the URL `<Logo>` masks. */
  mark?: string;
  /** `--brand-aspect`: the mark's width / height, e.g. `"387 / 335"`. */
  markAspect?: string;
  /** `--brand-font-<role>`: a family name per role; unset roles keep the kit's. */
  fonts?: Partial<Record<FontRole, string>>;
}

export type FontRole = "sans" | "display" | "mono";
export const FONT_ROLES: readonly FontRole[] = ["sans", "display", "mono"];
// aquafix's file calls the body family `text`.
const FONT_KEYS: Record<string, FontRole> = { sans: "sans", text: "sans", display: "display", mono: "mono" };

/** Every problem with a brand file at once, so one run fixes them all. */
export class PaletteError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`invalid brand palette:\n  - ${problems.join("\n  - ")}`);
    this.name = "PaletteError";
  }
}

// Written into CSS verbatim, so a value is held to a shape that cannot close
// the declaration: a hex colour, or a reference to another token.
const COLOUR = /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|var\(--[a-z0-9-]+\))$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const ASPECT = /^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/;
// Written inside `url("…")`: nothing that closes the string or the function,
// and no markup characters for a sheet that ends up inlined in HTML.
const MARK_URL = /^[^"'`\\\s()<>]+$/;
const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/;

/**
 * Reads the aquafix `brand.toml` shape: `[colors.light]` and `[colors.dark]`
 * keyed by contract name, optional top-level `mark` / `mark-aspect`, and the
 * family names in `[fonts]` (`sans` or `text`, `display`, `mono`). The rest of
 * `[fonts]` and every other table (`[print]`, …) belong to other tools and are
 * ignored — loading the font files is the site's job, not the palette's.
 */
export function brandFromToml(text: string): BrandConfig {
  const doc = parseToml(text);
  const problems: string[] = [];
  const colors = table(doc["colors"]);
  if (!colors) problems.push("no [colors] table");
  const scope = (name: PolarityName): Record<string, string> => {
    const t = colors ? table(colors[name]) : undefined;
    if (colors && !t) problems.push(`no [colors.${name}] table`);
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(t ?? {})) {
      if (typeof value === "string") out[key] = value;
      else problems.push(`colors.${name}.${key} is not a string`);
    }
    return out;
  };
  for (const key of Object.keys(colors ?? {})) {
    if (!(POLARITIES as readonly string[]).includes(key)) problems.push(`[colors.${key}] is not a polarity (light, dark)`);
  }
  const config: BrandConfig = { colors: { light: scope("light"), dark: scope("dark") } };
  const mark = optionalString(doc["mark"], "mark", problems);
  const markAspect = optionalString(doc["mark-aspect"], "mark-aspect", problems);
  if (mark !== undefined) config.mark = mark;
  if (markAspect !== undefined) config.markAspect = markAspect;
  const fonts = table(doc["fonts"]);
  for (const [key, role] of Object.entries(FONT_KEYS)) {
    const family = optionalString(fonts?.[key], `fonts.${key}`, problems);
    if (family !== undefined) config.fonts = { ...config.fonts, [role]: family };
  }
  if (problems.length > 0) throw new PaletteError(problems);
  return config;
}

function table(value: TomlValue | TomlTable | undefined): TomlTable | undefined {
  return typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function optionalString(value: TomlValue | TomlTable | undefined, key: string, problems: string[]) {
  if (value === undefined || typeof value === "string") return value;
  problems.push(`${key} is not a string`);
  return undefined;
}

/** The problems with `config` against `contract`; empty when it is complete. */
export function validateBrand(config: BrandConfig, contract: Contract): string[] {
  const problems: string[] = [];
  const known = new Set([...contract.required, ...contract.derived]);
  for (const polarity of POLARITIES) {
    const values = config.colors[polarity];
    const missing = contract.required.filter((t) => !(t in values));
    if (missing.length > 0) problems.push(`${polarity} is missing ${missing.join(", ")}`);
    for (const [key, value] of Object.entries(values)) {
      if (!known.has(key)) problems.push(`${polarity}.${key} is not a token of the contract`);
      else if (!COLOUR.test(value)) problems.push(`${polarity}.${key} = ${JSON.stringify(value)} is not #hex or var(--token)`);
      else {
        for (const ref of references(value)) {
          if (!known.has(ref)) problems.push(`${polarity}.${key} refers to --${ref}, which is not a token of the contract`);
        }
      }
    }
    const cycle = findCycle(values, contract, known);
    if (cycle) problems.push(`${polarity} has a reference cycle: ${cycle.map((t) => `--${t}`).join(" → ")}`);
  }
  if (config.mark !== undefined && !MARK_URL.test(config.mark)) problems.push(`mark ${JSON.stringify(config.mark)} is not a plain URL`);
  if (config.markAspect !== undefined && !ASPECT.test(config.markAspect)) {
    problems.push(`mark-aspect ${JSON.stringify(config.markAspect)} is not "width / height"`);
  }
  for (const [role, family] of Object.entries(config.fonts ?? {})) {
    if (!FAMILY.test(family)) problems.push(`fonts.${role} ${JSON.stringify(family)} is not a plain family name`);
  }
  return problems;
}

/**
 * A `var()` cycle makes every token on it invalid at computed-value time — the
 * same silent hole as a missing token. Edges are the palette's own references,
 * and for a derived token it leaves to the contract, the contract's formula
 * (`border` reads `ink`), so `ink = "var(--border)"` is caught too.
 */
function findCycle(values: Record<string, string>, contract: Contract, known: Set<string>): string[] | undefined {
  const edges = (name: string): readonly string[] => {
    const value = values[name];
    if (value !== undefined) return references(value).filter((r) => known.has(r));
    return contract.derivedFrom[name] ?? [];
  };
  const done = new Set<string>();
  const path: string[] = [];
  const visit = (name: string): string[] | undefined => {
    const at = path.indexOf(name);
    if (at >= 0) return [...path.slice(at), name];
    if (done.has(name)) return undefined;
    path.push(name);
    for (const next of edges(name)) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    path.pop();
    done.add(name);
    return undefined;
  };
  for (const name of known) {
    const cycle = visit(name);
    if (cycle) return cycle;
  }
  return undefined;
}

/**
 * A flat sheet scoping `config` under `[data-brand="<brand>"]`: light is the
 * brand's default and `.light` / `.dark` beneath it pick a polarity. Selectors
 * outrank the zero-specificity EV palette, so import order does not matter.
 * Throws a {@link PaletteError} when a scope is incomplete — Tailwind answers an
 * undefined token with no rule at all, so a hole would be silent on the page.
 */
export function renderPalette(brand: string, config: BrandConfig, contract: Contract, source = "a brand file"): string {
  const problems = SLUG.test(brand) ? [] : [`brand ${JSON.stringify(brand)} is not a lowercase slug`];
  problems.push(...validateBrand(config, contract));
  if (problems.length > 0) throw new PaletteError(problems);

  const at = `[data-brand="${brand}"]`;
  const order = [...contract.required, ...contract.derived];
  const block = (selectors: string[], polarity: PolarityName) => {
    const values = config.colors[polarity];
    const body = order.filter((t) => t in values).map((t) => `  --${t}: ${values[t]};\n`);
    return `${selectors.join(",\n")} {\n  --scheme: ${polarity};\n${body.join("")}}\n`;
  };
  const extras: string[] = [];
  if (config.mark !== undefined) extras.push(`  --brand-mark: url("${config.mark}");\n`);
  if (config.markAspect !== undefined) extras.push(`  --brand-aspect: ${config.markAspect};\n`);
  for (const role of FONT_ROLES) {
    const family = config.fonts?.[role];
    if (family !== undefined) extras.push(`  --brand-font-${role}: "${family}";\n`);
  }

  return [
    // `source` is a file name, free text as far as CSS is concerned: it must not close the comment.
    `/* GENERATED by evinvest-palette from ${source.replaceAll("*/", "*\\/")} — do not edit. */\n`,
    block([at, `${at}.light`, `${at} .light`], "light"),
    block([`${at}.dark`, `${at} .dark`], "dark"),
    ...(extras.length > 0 ? [`${at} {\n${extras.join("")}}\n`] : []),
  ].join("\n");
}
