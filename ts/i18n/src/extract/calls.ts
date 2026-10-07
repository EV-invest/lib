/**
 * Reading `t(key, en)` call sites out of one parsed file — shared by the
 * catalogue extractor and the slice generator, so both refuse exactly the same
 * call sites.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

/** One readable `t()` call site. */
export interface Entry {
  key: string;
  /** The English as written at the call site. */
  en: string;
  /** `path/to/file.tsx:12` — where it was read from. */
  where: string;
}

/** What {@link collect} reads, and what it refuses to guess at. */
export interface Extraction {
  entries: Entry[];
  errors: string[];
}

/** Skipped by every app: package manager and tool output nothing authors. */
export const DEFAULT_EXCLUDE: readonly string[] = ["node_modules", "dist", "build", ".next"];

/** `.ts`, `.tsx`, `.mts`, `.mtsx` — a build script renders copy as readily as a component. */
export const SOURCE = /\.m?tsx?$/;

export function* sourceFiles(
  root: string,
  exclude: ReadonlySet<string>,
  dir: string,
): Generator<string> {
  for (const item of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (item.name.startsWith(".") || exclude.has(item.name)) continue;
    const path = dir === "" ? item.name : `${dir}/${item.name}`;
    if (item.isDirectory()) yield* sourceFiles(root, exclude, path);
    else if (SOURCE.test(item.name)) yield path;
  }
}

/** TSX for every file: a `.ts` file parses the same, and JSX in it is then not an error. */
export const parse = (path: string, text: string): ts.SourceFile =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

/** `path:line` of a node, for an error or an entry. */
export const where = (path: string, source: ts.SourceFile, node: ts.Node): string =>
  `${path}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;

/** A string literal or a backtick string with no `${}` in it. */
export function literal(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

/** Every `t(key, en)` in one parsed file, plus the call sites that cannot be read. */
export function callsIn(path: string, source: ts.SourceFile): Extraction {
  const entries: Entry[] = [];
  const errors: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t") {
      const [keyArg, enArg] = node.arguments;
      const key = keyArg === undefined ? null : literal(keyArg);
      const en = enArg === undefined ? null : literal(enArg);
      const at = where(path, source, node);
      if (key === null) errors.push(`${at}: t() key is not a string literal`);
      else if (en === null) errors.push(`${at}: t("${key}", …) has no literal English second argument`);
      else entries.push({ key, en, where: at });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { entries, errors };
}

/**
 * One entry per key. Two call sites sharing a key with different English are
 * an error — the catalogue can only hold one of them, so which one ships would
 * be decided by file order.
 */
export function dedupe(entries: readonly Entry[]): Extraction {
  const seen = new Map<string, Entry>();
  const errors: string[] = [];
  for (const entry of entries) {
    const first = seen.get(entry.key);
    if (first === undefined) seen.set(entry.key, entry);
    else if (first.en !== entry.en)
      errors.push(
        `${entry.where}: "${entry.key}" is also defined at ${first.where} with different English\n` +
          `    ${first.where}: ${JSON.stringify(first.en)}\n` +
          `    ${entry.where}: ${JSON.stringify(entry.en)}`,
      );
  }
  return { entries: [...seen.values()], errors };
}

/** The exact bytes a generated JSON file is written as — what a check compares against. */
export const serialise = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/**
 * Input a tool cannot work with — a bad flag, a malformed config, a missing
 * directory. {@link runCli} prints its message alone; anything else is a bug
 * and keeps its stack.
 */
export class InputError extends Error {
  override readonly name = "InputError";
}

/** What {@link parseFlags} read; `help` is set when `-h` / `--help` was among the arguments. */
export interface Flags<V extends string, S extends string> {
  help: boolean;
  value: (name: V) => string | undefined;
  on: (name: S) => boolean;
}

/**
 * The bins' one argument parser: `--name value` or `--name=value` for each of
 * `values`, a bare `--name` for each of `switches`, `-h` / `--help`.
 *
 * Strict on purpose. A tool that writes a committed file must not read a typo
 * (`--ouT`, `--help` misspelt, a forgotten value) as "use the defaults" and then
 * overwrite that file with something else, so anything it does not know is an
 * {@link InputError}, raised before a single file is read.
 */
export function parseFlags<V extends string, S extends string = never>(
  argv: readonly string[],
  values: readonly V[],
  switches: readonly S[] = [],
): Flags<V, S> {
  const isValue = (name: string): name is V => (values as readonly string[]).includes(name);
  const isSwitch = (name: string): name is S => (switches as readonly string[]).includes(name);
  const known = [...values.map(v => `--${v} <value>`), ...switches.map(s => `--${s}`), "--help"];
  const read = new Map<string, string>();
  const set = new Set<string>();
  let help = false;

  for (let at = 0; at < argv.length; at++) {
    const arg = argv[at] ?? "";
    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new InputError(`unexpected argument "${arg}"`);
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (read.has(name) || set.has(name)) throw new InputError(`--${name} given more than once`);
    if (isSwitch(name)) {
      if (eq !== -1) throw new InputError(`--${name} takes no value`);
      set.add(name);
    } else if (isValue(name)) {
      const value = eq === -1 ? argv[++at] : arg.slice(eq + 1);
      if (value === undefined || value === "" || value.startsWith("-"))
        throw new InputError(`--${name} needs a value`);
      read.set(name, value);
    } else {
      throw new InputError(`unknown flag --${name}; known: ${known.join(", ")}`);
    }
  }
  return { help, value: name => read.get(name), on: name => set.has(name) };
}

/**
 * Run a bin's body: an {@link InputError}, or a file the arguments name that
 * does not exist, prints `<bin>: <message>` and exits 2; anything else
 * propagates with its stack.
 */
export function runCli(bin: string, main: () => void): void {
  try {
    main();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const missing = "code" in error && error.code === "ENOENT";
    if (!(error instanceof InputError) && !missing) throw error;
    console.error(`${bin}: ${error.message}`);
    console.error(`Run \`${bin} --help\` for usage.`);
    process.exit(2);
  }
}

/** `a,b,,c` → `["a", "b", "c"]`. */
export const list = (value: string | undefined): string[] =>
  (value ?? "").split(",").filter(s => s !== "");
