// The `files` and `exports` fields are a promise about what ships, so they are
// checked rather than trusted: every path an export names must be in the
// tarball, and so must every entry `REQUIRED` lists beyond the exports.
//
// Runs from `prepublishOnly`, which `npm pack` does not trigger, so the nested
// pack below cannot recurse. Same shape as the kit's own check.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

/** Every file path an `exports` / `bin` entry points at. */
function targets(node) {
  if (typeof node === "string") return [node.replace(/^\.\//, "")];
  if (node && typeof node === "object") return Object.values(node).flatMap(targets);
  return [];
}

const REQUIRED = [
  "package.json",
  "README.md",
  ...targets(manifest.exports),
  ...targets(manifest.bin ?? {}),
  ...(manifest.kitstartPack ?? []),
];

const out = execFileSync("npm", ["pack", "--dry-run", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

// The nested pack re-runs `prepare`, whose output lands on stdout ahead of the
// JSON, so the report is recovered by parsing the last array the output ends with.
function trailingJson(text) {
  for (let i = text.lastIndexOf("["); i >= 0; i = text.lastIndexOf("[", i - 1)) {
    try {
      return JSON.parse(text.slice(i));
    } catch {
      // not the start of the report — keep walking back
    }
  }
  throw new Error(`could not find the pack report in:\n${text}`);
}

const shipped = new Set(trailingJson(out)[0].files.map((f) => f.path));
const missing = [...new Set(REQUIRED)].filter((p) => !shipped.has(p));

if (missing.length > 0) {
  console.error(`refusing to publish: the tarball is missing ${missing.join(", ")}`);
  console.error(`it contains: ${[...shipped].sort().join(", ")}`);
  process.exit(1);
}

console.log(`verify-pack: ${new Set(REQUIRED).size} required paths present in the tarball`);
