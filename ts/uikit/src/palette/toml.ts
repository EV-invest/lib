/**
 * The subset of TOML a brand file is written in: `[table.headers]`, bare keys,
 * and single-line values that are a basic string, a number, a boolean, or a
 * flat array of those. Anything else is an error naming the line, rather than a
 * silent misread — the kit stays dependency-free, and a brand file has no use
 * for the rest of the language.
 */

export type TomlValue = string | number | boolean | TomlValue[];
export interface TomlTable {
  [key: string]: TomlValue | TomlTable;
}

const BARE_KEY = /^[A-Za-z0-9_-]+$/;

export function parseToml(text: string): TomlTable {
  const root: TomlTable = {};
  let table = root;
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = stripComment(raw).trim();
    if (line === "") return;
    const fail = (why: string): never => {
      throw new Error(`TOML line ${index + 1}: ${why}: ${raw.trim()}`);
    };

    if (line.startsWith("[")) {
      if (!line.endsWith("]") || line.startsWith("[[")) fail("only plain [table] headers are supported");
      table = descend(root, line.slice(1, -1).trim().split("."), fail);
      return;
    }

    const eq = line.indexOf("=");
    if (eq < 0) fail("expected `key = value`");
    const key = line.slice(0, eq).trim();
    if (!BARE_KEY.test(key)) fail("only bare keys are supported");
    if (key in table) fail(`duplicate key \`${key}\``);
    table[key] = parseValue(line.slice(eq + 1).trim(), fail);
  });
  return root;
}

function descend(root: TomlTable, path: string[], fail: (why: string) => never): TomlTable {
  let table = root;
  for (const part of path) {
    const key = part.trim();
    if (!BARE_KEY.test(key)) fail("only bare keys are supported in a header");
    const next = table[key] ?? {};
    if (typeof next !== "object" || Array.isArray(next)) fail(`\`${key}\` is already a value`);
    table[key] = next;
    table = next as TomlTable;
  }
  return table;
}

// A `#` inside a string is not a comment; the brand files carry `"#rrggbb"`.
function stripComment(line: string): string {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\" && quoted) i++;
    else if (c === '"') quoted = !quoted;
    else if (c === "#" && !quoted) return line.slice(0, i);
  }
  return line;
}

function parseValue(src: string, fail: (why: string) => never): TomlValue {
  if (src.startsWith('"')) {
    if (src.length < 2 || !src.endsWith('"')) fail("unterminated string");
    const body = src.slice(1, -1);
    if (/(^|[^\\])(\\\\)*"/.test(body)) fail("one string per value");
    return body.replace(/\\(["\\nt])/g, (_, c: string) => ({ n: "\n", t: "\t" })[c] ?? c);
  }
  if (src.startsWith("[")) {
    if (!src.endsWith("]")) fail("arrays must close on the same line");
    const inner = src.slice(1, -1).trim();
    if (inner === "") return [];
    return splitTopLevel(inner).map((item) => parseValue(item.trim(), fail));
  }
  if (src === "true" || src === "false") return src === "true";
  if (/^[+-]?\d+(\.\d+)?$/.test(src)) return Number(src);
  return fail("unsupported value");
}

function splitTopLevel(inner: string): string[] {
  const items: string[] = [];
  let quoted = false;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "\\" && quoted) i++;
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) {
      items.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  const last = inner.slice(start);
  if (last.trim() !== "") items.push(last);
  return items;
}
