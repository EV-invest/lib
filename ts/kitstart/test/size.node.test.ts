import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { firstLoadChunks, GATED_ROUTE, measure, parseArgs, parseBudget } from "../src/cli/size";

// The gate fails closed: every way of reading nothing must be an error, never
// a total of zero that passes.
describe("kitstart-size", () => {
  it("takes the last non-comment line of the budget, and only a number", () => {
    expect(parseBudget("# why\n\n1234\n")).toBe(1234);
    expect(() => parseBudget("# only prose\n")).toThrow();
    expect(() => parseBudget("# why\n12 KB\n")).toThrow();
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

  const build = (chunk: string, budget: number) => {
    const repo = mkdtempSync(join(tmpdir(), "kitstart-size-"));
    mkdirSync(join(repo, ".next/diagnostics"), { recursive: true });
    mkdirSync(join(repo, "tests"));
    writeFileSync(join(repo, ".next/a.js"), chunk);
    writeFileSync(join(repo, ".next/diagnostics/route-bundle-stats.json"), JSON.stringify([{ route: GATED_ROUTE, firstLoadChunkPaths: [".next/a.js"] }]));
    writeFileSync(join(repo, "tests/bundle_budget.txt"), `# a reason\n${budget}\n`);
    return repo;
  };

  it("passes under budget and fails over it", () => {
    const log = { log: vi.fn(), error: vi.fn() };
    const repo = build("x".repeat(1000), 1000);
    expect(measure(parseArgs([], repo), log)).toBe(0);
    expect(measure(parseArgs([], build("x".repeat(1000), 5)), log)).toBe(1);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("over budget"));
  });

  it("fails, never passes, without a build", () => {
    const log = { log: vi.fn(), error: vi.fn() };
    expect(measure(parseArgs([], mkdtempSync(join(tmpdir(), "kitstart-size-"))), log)).toBe(1);
  });
});
