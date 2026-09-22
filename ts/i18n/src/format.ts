/**
 * The ICU-subset formatter, typed on a bare language tag rather than on a
 * registry's `Locale` union. It only ever hands the tag to `Intl.PluralRules`
 * and `Intl.NumberFormat`, so the generated registry and every one built with
 * `createLocaleRegistry` share one implementation. The locale-typed public
 * wrappers live in the core and on each registry.
 */

/** Values interpolated into a message pattern. */
export type MessageValues = Readonly<Record<string, string | number>>;

/** Format one ICU-subset pattern; see `formatMessage` in the core for the contract. */
export function formatPattern(pattern: string, locale: string, values: MessageValues = {}): string {
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
  locale: string,
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
  locale: string,
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
