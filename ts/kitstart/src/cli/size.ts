import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * The one hard gate of a landing: the gzip weight of the JavaScript a place
 * page makes the browser download before it is interactive, against the
 * brand's committed budget. Run after `next build`; `mkLanding`'s
 * `bundle-budget` check runs it against the Nix build.
 */

/** The page the visitor lands on; every place page shares its chunks. */
export const GATED_ROUTE = "/[locale]/[location]";
export const STATS = ".next/diagnostics/route-bundle-stats.json";
export const BUDGET = "tests/bundle_budget.txt";

interface RouteStats {
  route: string;
  firstLoadChunkPaths: string[];
}

/** The budget file is commented prose; the number is its last non-comment line. */
export function parseBudget(text: string, file = BUDGET): number {
  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l !== "" && !l.startsWith("#"));
  const last = lines.at(-1);
  if (last === undefined || !/^\d+$/.test(last)) {
    throw new Error(`${file}: the last non-comment line must be a byte count, got ${JSON.stringify(last)}`);
  }
  return Number(last);
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

/** Prints the chunks and the total; returns the exit code. */
export function measure(args: SizeArgs, log: Pick<Console, "log" | "error"> = console): number {
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
  log.log(`  ${args.route}: ${kb(total)} KB gz (${kb(raw)} KB raw) / budget ${kb(budget)} KB gz`);
  if (total > budget) {
    log.error(`✘ over budget by ${total - budget} B. Raising ${args.budget} is a deliberate commit, with a reason.`);
    return 1;
  }
  return 0;
}
