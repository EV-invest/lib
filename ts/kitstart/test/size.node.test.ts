import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ceilingOf, DEFAULT_TOLERANCE_PERCENT, firstLoadChunks, GATED_ROUTE, gzipSize, judge, measure, parseArgs, parseBudget } from "../src/cli/size";

// The gate fails closed: every way of reading nothing must be an error, never
// a total of zero that passes.
describe("kitstart-size", () => {
  it("reads a single number as the target, with the default tolerance", () => {
    expect(parseBudget("# why\n\n1234\n")).toEqual({ target: 1234, tolerancePercent: DEFAULT_TOLERANCE_PERCENT });
    expect(DEFAULT_TOLERANCE_PERCENT).toBe(20);
    expect(() => parseBudget("# only prose\n")).toThrow(/no byte count/);
    expect(() => parseBudget("# why\n12 KB\n")).toThrow();
  });

  it("takes a tolerance override, on any line, once", () => {
    expect(parseBudget("158000\ntolerance 5%\n")).toEqual({ target: 158000, tolerancePercent: 5 });
    expect(parseBudget("# why\ntolerance 0 %\n# more\n158000\n")).toEqual({ target: 158000, tolerancePercent: 0 });
    expect(parseBudget("1000\ntolerance 12.5%\n").tolerancePercent).toBe(12.5);
    expect(() => parseBudget("1000\n2000\n")).toThrow();
    expect(() => parseBudget("1000\ntolerance 5%\ntolerance 6%\n")).toThrow();
    expect(() => parseBudget("1000\ntolerance 5\n")).toThrow();
    expect(() => parseBudget("tolerance 5%\n")).toThrow(/no byte count/);
  });

  it("judges exactly at the target and at the tolerance edge", () => {
    const budget = { target: 158000, tolerancePercent: 20 };
    expect(ceilingOf(budget)).toBe(189600);
    expect(judge(158000, budget)).toBe("under");
    expect(judge(158001, budget)).toBe("tolerated");
    expect(judge(162968, budget)).toBe("tolerated");
    expect(judge(189600, budget)).toBe("tolerated");
    expect(judge(189601, budget)).toBe("over");
    // A ceiling that is not a whole byte rounds down: never more than the percent allows.
    expect(ceilingOf({ target: 1001, tolerancePercent: 10 })).toBe(1101);
    expect(ceilingOf({ target: 1000, tolerancePercent: 0 })).toBe(1000);
    expect(judge(1001, { target: 1000, tolerancePercent: 0 })).toBe("over");
  });

  it("finds the gated route's chunks, and refuses a missing route or an empty list", () => {
    const stats = JSON.stringify([{ route: "/health", firstLoadChunkPaths: [] }, { route: GATED_ROUTE, firstLoadChunkPaths: ["a.js", "b.js"] }]);
    expect(firstLoadChunks(stats, GATED_ROUTE)).toEqual(["a.js", "b.js"]);
    expect(() => firstLoadChunks("[]", GATED_ROUTE)).toThrow(/no entry/);
    expect(() => firstLoadChunks(JSON.stringify([{ route: GATED_ROUTE, firstLoadChunkPaths: [] }]), GATED_ROUTE)).toThrow(/no chunks/);
    expect(() => firstLoadChunks("{}", GATED_ROUTE)).toThrow(/array/);
  });

  it("reads its arguments", () => {
    expect(parseArgs(["/nix/store/x", "--route", "/[locale]"], "/repo")).toEqual({ repo: "/repo", root: "/nix/store/x", route: "/[locale]", budget: "tests/bundle_budget.txt" });
    expect(() => parseArgs(["--route"], "/repo")).toThrow(/needs a value/);
    expect(() => parseArgs(["--nope"], "/repo")).toThrow(/unknown/);
  });

  const build = (chunk: string, budget: number | string) => {
    const repo = mkdtempSync(join(tmpdir(), "kitstart-size-"));
    mkdirSync(join(repo, ".next/diagnostics"), { recursive: true });
    mkdirSync(join(repo, "tests"));
    writeFileSync(join(repo, ".next/a.js"), chunk);
    writeFileSync(join(repo, ".next/diagnostics/route-bundle-stats.json"), JSON.stringify([{ route: GATED_ROUTE, firstLoadChunkPaths: [".next/a.js"] }]));
    writeFileSync(join(repo, "tests/bundle_budget.txt"), `# a reason\n${budget}\n`);
    return repo;
  };

  // A thousand x's gzip to a few dozen bytes; the budgets are set around that.
  const gz = gzipSize(Buffer.from("x".repeat(1000)));
  const quiet = () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn() });

  it("passes at the target, silently", () => {
    const log = quiet();
    expect(measure(parseArgs([], build("x".repeat(1000), gz)), log, {})).toBe(0);
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("passes within the tolerance, loudly, with an annotation on GitHub Actions only", () => {
    const repo = build("x".repeat(1000), `${gz - 1}\ntolerance 50%`);
    const local = quiet();
    expect(measure(parseArgs([], repo), local, {})).toBe(0);
    expect(local.warn).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`is 1 B \\(\\d+\\.\\d %\\) over its target of ${gz - 1} B`)));
    expect(local.log).not.toHaveBeenCalledWith(expect.stringContaining("::warning"));
    const ci = quiet();
    expect(measure(parseArgs([], repo), ci, { GITHUB_ACTIONS: "true" })).toBe(0);
    expect(ci.log).toHaveBeenCalledWith(expect.stringMatching(/^::warning file=tests\/bundle_budget\.txt,title=Bundle over its target::/));
  });

  it("fails past the tolerance", () => {
    const log = quiet();
    expect(measure(parseArgs([], build("x".repeat(1000), `${gz - 1}\ntolerance 0%`)), log, {})).toBe(1);
    expect(measure(parseArgs([], build("x".repeat(1000), 5)), log, {})).toBe(1);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("past its 0 % tolerance by 1 B"));
  });

  it("fails, never passes, without a build", () => {
    const log = quiet();
    expect(measure(parseArgs([], mkdtempSync(join(tmpdir(), "kitstart-size-"))), log)).toBe(1);
  });
});
