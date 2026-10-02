import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * The one hard gate of a landing: the gzip weight of the JavaScript a place
 * page makes the browser download before it is interactive, against the
 * brand's committed budget. Run after `next build`; `mkLanding`'s
 * `bundle-budget` check runs it against the Nix build.
 *
 * The budget is a target with a bounded overshoot: at or under the target
 * passes; up to `tolerance` over it passes with a loud warning (an annotation
 * on GitHub Actions), so a feature can land while the weight is paid back;
 * past that it fails.
 */

/** The page the visitor lands on; every place page shares its chunks. */
export const GATED_ROUTE = "/[locale]/[location]";
export const STATS = ".next/diagnostics/route-bundle-stats.json";
export const BUDGET = "tests/bundle_budget.txt";

interface RouteStats {
  route: string;
  firstLoadChunkPaths: string[];
}

/** How far over the target a build may go, with a warning, when the file does not say. */
export const DEFAULT_TOLERANCE_PERCENT = 20;

export interface Budget {
  /** The size the page should be: gzip bytes. */
  target: number;
  /** Percent over `target` that passes with a warning. */
  tolerancePercent: number;
}

/**
 * The budget file is commented prose around a byte count — the target — and,
 * optionally, a `tolerance <n>%` line. A file of one number, as every budget
 * was before tolerances, is that target with the default tolerance. Any other
 * line is an error: a gate that guesses at its own file is no gate.
 */
export function parseBudget(text: string, file = BUDGET): Budget {
  let target: number | undefined;
  let tolerancePercent: number | undefined;
  for (const line of text.split("\n").map(l => l.trim())) {
    if (line === "" || line.startsWith("#")) continue;
    const tolerance = /^tolerance\s+(\d+(?:\.\d+)?)\s*%$/.exec(line);
    if (/^\d+$/.test(line) && target === undefined) target = Number(line);
    else if (tolerance && tolerancePercent === undefined) tolerancePercent = Number(tolerance[1]);
    else throw new Error(`${file}: expected one byte count and at most one \`tolerance <n>%\` line, got ${JSON.stringify(line)}`);
  }
  if (target === undefined) throw new Error(`${file}: no byte count — the target is a line of digits`);
  return { target, tolerancePercent: tolerancePercent ?? DEFAULT_TOLERANCE_PERCENT };
}

export type Verdict = "under" | "tolerated" | "over";

/** The largest size that still passes: the target plus its tolerance, rounded down. */
export const ceilingOf = (budget: Budget): number => Math.floor((budget.target * (100 + budget.tolerancePercent)) / 100);

export function judge(total: number, budget: Budget): Verdict {
  if (total <= budget.target) return "under";
  return total <= ceilingOf(budget) ? "tolerated" : "over";
}

function isRouteStats(value: unknown): value is RouteStats {
  if (typeof value !== "object" || value === null) return false;
  const route: unknown = Reflect.get(value, "route");
  const chunks: unknown = Reflect.get(value, "firstLoadChunkPaths");
  return typeof route === "string" && Array.isArray(chunks) && chunks.every(c => typeof c === "string");
}

/**
 * The chunks Next itself lists as the route's first load. Undocumented output,
 * which is why a missing file or route is a failure and never a pass: a gate
 * that reads nothing and reports zero is worse than no gate.
 */
export function firstLoadChunks(statsJson: string, route: string): string[] {
  const parsed: unknown = JSON.parse(statsJson);
  if (!Array.isArray(parsed)) throw new Error(`${STATS}: expected an array of routes`);
  const entry = parsed.filter(isRouteStats).find(r => r.route === route);
  if (!entry) throw new Error(`${STATS}: no entry for ${route} — did the route move, or Next's diagnostics?`);
  if (entry.firstLoadChunkPaths.length === 0) throw new Error(`${STATS}: ${route} lists no chunks`);
  return entry.firstLoadChunkPaths;
}

/** gzip at zlib's default level, which is what Next's own server compresses with. */
export const gzipSize = (bytes: Buffer): number => gzipSync(bytes).length;

export interface SizeArgs {
  /** Where `tests/bundle_budget.txt` is: the brand repo. */
  repo: string;
  /** Where `.next/` is: the repo, or the Nix build's output. */
  root: string;
  route: string;
  budget: string;
}

export function parseArgs(argv: readonly string[], cwd: string): SizeArgs {
  const args: SizeArgs = { repo: cwd, root: cwd, route: GATED_ROUTE, budget: BUDGET };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };
    if (arg === "--route") args.route = value();
    else if (arg === "--budget") args.budget = value();
    else if (arg !== undefined && !arg.startsWith("--")) args.root = arg;
    else throw new Error(`unknown argument ${arg}`);
  }
  return args;
}

/** Prints the chunks and the total; returns the exit code. `env` says whether this is GitHub Actions. */
export function measure(
  args: SizeArgs,
  log: Pick<Console, "log" | "warn" | "error"> = console,
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  let stats: string;
  try {
    stats = readFileSync(join(args.root, STATS), "utf8");
  } catch {
    log.error(`✘ ${join(args.root, STATS)} is missing — run \`next build\` first`);
    return 1;
  }
  const budget = parseBudget(readFileSync(join(args.repo, args.budget), "utf8"), args.budget);
  let total = 0;
  let raw = 0;
  for (const chunk of firstLoadChunks(stats, args.route)) {
    const bytes = readFileSync(join(args.root, chunk));
    const gz = gzipSize(bytes);
    total += gz;
    raw += bytes.length;
    log.log(`  ${String(gz).padStart(8)} B gz  ${relative(args.root, join(args.root, chunk))}`);
  }
  const kb = (n: number) => (n / 1024).toFixed(1);
  const ceiling = ceilingOf(budget);
  log.log(`  ${args.route}: ${kb(total)} KB gz (${kb(raw)} KB raw) / target ${kb(budget.target)} KB gz, ceiling ${kb(ceiling)} KB gz (+${budget.tolerancePercent} %)`);
  const over = total - budget.target;
  const percent = ((over / budget.target) * 100).toFixed(1);
  switch (judge(total, budget)) {
    case "under":
      return 0;
    case "tolerated": {
      const message = `${args.route} is ${over} B (${percent} %) over its target of ${budget.target} B gz — within the ${budget.tolerancePercent} % tolerance (${ceiling} B), so it passes. Pay it back, or raise the target in ${args.budget} with a reason.`;
      log.warn(`⚠ ${message}`);
      if (env["GITHUB_ACTIONS"] === "true") log.log(`::warning file=${args.budget},title=Bundle over its target::${message}`);
      return 0;
    }
    case "over":
      log.error(`✘ ${over} B (${percent} %) over the target of ${budget.target} B gz, past its ${budget.tolerancePercent} % tolerance by ${total - ceiling} B. Raising ${args.budget} is a deliberate commit, with a reason.`);
      return 1;
  }
}
