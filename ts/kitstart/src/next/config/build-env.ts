// Build-time only: read by `next.config.ts` and `vitest.config.ts`, never by
// app code. `assets/` is the one place a contact fact, the mark or a colour is
// written — the printed card, the vCards and the site all read it — so the
// site takes them at build time and inlines them rather than keeping a copy.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface CardFacts {
  /** As printed: international, spaced. `tel:` and `wa.me` derive from it; `null` → no phone channel. */
  phone: string | null;
  email: string | null;
  /** The domain; `null` → a site before launch (noindex everywhere). */
  site: string | null;
}

type Table = Record<string, string>;

/**
 * The slice of TOML these two files use for the values read here: `[a.b]`
 * headers and `key = "basic string"` lines; everything else (arrays, numbers,
 * comments) is skipped — not the kit's `parseToml`, to keep `next.config.ts`
 * free of the kit. `evinvest-palette` still validates brand.toml in full.
 */
export function readStringTables(text: string): Record<string, Table> {
  const tables: Record<string, Table> = { "": {} };
  let current = "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const header = /^\[([A-Za-z0-9_.-]+)\]$/.exec(line);
    if (header?.[1]) {
      current = header[1];
      tables[current] ??= {};
      continue;
    }
    const pair = /^([A-Za-z0-9_-]+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*(?:#.*)?$/.exec(line);
    if (pair?.[1] && pair[2] !== undefined) {
      const table = (tables[current] ??= {});
      table[pair[1]] = pair[2].replace(/\\(["\\])/g, "$1");
    }
  }
  return tables;
}

function readToml(root: string, file: string): Record<string, Table> {
  return readStringTables(readFileSync(join(root, file), "utf8"));
}

export function readCard(root: string): CardFacts {
  const toml = readToml(root, "assets/card.toml")[""] ?? {};
  // Optional for the web: a brand may launch with no phone line and no domain
  // yet. Present but blank is still an error — a typo, not a choice.
  const field = (key: keyof CardFacts): string | null => {
    if (!Object.hasOwn(toml, key)) return null;
    const value = toml[key];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`assets/card.toml: \`${key}\` must be a non-empty string when present`);
    }
    return value;
  };
  const phone = field("phone");
  // A national number cannot become `tel:+…` or `wa.me/…` without guessing a
  // country, and a mistyped call target is the most expensive silent bug on
  // this page.
  if (phone !== null && !phone.startsWith("+")) {
    throw new Error(`assets/card.toml: phone must be international, got ${JSON.stringify(phone)}`);
  }
  return { phone, email: field("email"), site: field("site") };
}

/**
 * The inner markup of `assets/mark.svg` — the path, not the `<svg>` wrapper,
 * which the component writes itself so it can size and colour it. The fill is
 * `currentColor`, which an `<img>` could not inherit.
 */
export function readMarkPath(root: string): string {
  const svg = readFileSync(join(root, "assets/mark.svg"), "utf8");
  const d = /\sd="([^"]+)"/.exec(svg)?.[1];
  if (!d) throw new Error("assets/mark.svg: no <path d=…> to inline");
  return d;
}

export type OgPalette = Record<"background" | "card" | "ink" | "inkSoft" | "primary", string>;

/**
 * The dark scope's values for the OG card. `ImageResponse` draws with inline
 * styles and cannot read a custom property, so the card takes the palette's
 * values at build time instead of a second copy of them in code.
 */
export function readOgPalette(root: string): OgPalette {
  const dark = readToml(root, "assets/brand.toml")["colors.dark"] ?? {};
  const pick = (key: string): string => {
    const value = dark[key];
    if (value === undefined) throw new Error(`assets/brand.toml: [colors.dark] ${key} is missing`);
    return value;
  };
  return {
    background: pick("background"),
    card: pick("card"),
    ink: pick("ink"),
    inkSoft: pick("ink-soft"),
    primary: pick("primary"),
  };
}

/** Everything inlined as `process.env.*`, under the names app code reads. */
export function buildEnv(root: string): Record<string, string> {
  const card = readCard(root);
  return {
    // An absent fact is inlined as "", which `cardFact` reads back as `null`.
    SITE_CARD_PHONE: card.phone ?? "",
    SITE_CARD_EMAIL: card.email ?? "",
    SITE_CARD_SITE: card.site ?? "",
    SITE_MARK_PATH: readMarkPath(root),
    SITE_OG_PALETTE: JSON.stringify(readOgPalette(root)),
  };
}
