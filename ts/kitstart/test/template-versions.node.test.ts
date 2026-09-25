import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { satisfies } from "../scripts/semver.mjs";

// scripts/publish.rs moves these on every release; this catches a hand release,
// or an @evinvest dependency it was never taught, in seconds rather than in the
// template job's full `next build`.
const kitstart = resolve(import.meta.dirname, "..");
const workspace = resolve(kitstart, "..");

interface Manifest {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const readManifest = (dir: string): Manifest => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;

const workspaceVersions = new Map<string, string>();
for (const entry of readdirSync(workspace, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  let manifest: Manifest;
  try {
    manifest = readManifest(join(workspace, entry.name));
  } catch {
    continue;
  }
  if (manifest.name && manifest.version) workspaceVersions.set(manifest.name, manifest.version);
}

const kitstartVersion = workspaceVersions.get("@evinvest/kitstart");
const template = readManifest(join(kitstart, "template"));
const own = Object.entries({ ...template.dependencies, ...template.devDependencies }).filter(([name]) => workspaceVersions.has(name));

describe("template versions", () => {
  it("depends on the workspace packages it is released with", () => {
    expect(own.map(([name]) => name)).toEqual(expect.arrayContaining(["@evinvest/kitstart", "@evinvest/uikit"]));
  });

  it.each(own)("admits the workspace %s with %s", (name, range) => {
    const version = workspaceVersions.get(name) ?? "";
    expect(satisfies(version, range), `${name}@${range} does not admit ${version}`).toBe(true);
  });

  it.each(["template/flake.nix", "README.md"])("%s pins the lib flake to this kitstart's tag", file => {
    const tags = readFileSync(join(kitstart, file), "utf8").match(/@evinvest\/kitstart-v\d+\.\d+\.\d+/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    expect(new Set(tags)).toEqual(new Set([`@evinvest/kitstart-v${kitstartVersion}`]));
  });
});
