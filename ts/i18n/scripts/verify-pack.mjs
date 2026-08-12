// The `files` field is a promise about what ships, so it is checked rather than
// trusted. `@evinvest/uikit@0.8.1` is the precedent: a generated file sat in a
// directory carrying a .gitignore for it, npm fell back to that .gitignore when
// packing, and the tarball was built without it. Nothing failed — every consumer
// simply broke on install.
//
// This package is more exposed than most, because it has three entry points
// (`.`, `./react`, `./next`) built by two tsup configs, and they share a
// hash-named chunk. A fixed file list cannot guard that: the chunk's name
// changes every build. So the entry points' own imports are followed instead,
// and every local file they reach must be in the tarball.
//
// Runs from `prepublishOnly`, which `npm pack` does not trigger, so the nested
// pack below cannot recurse.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const ENTRIES = ["dist/index.js", "dist/react.js", "dist/next.js"];
const REQUIRED = [
  "package.json",
  ...ENTRIES,
  "dist/index.d.ts",
  "dist/react.d.ts",
  "dist/next.d.ts",
];

const out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});

// The nested pack re-runs `prepare`, whose bundler chatters on stdout ahead of
// the JSON, so the report is recovered by parsing the last array it ends with.
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

const shipped = new Set(trailingJson(out)[0].files.map(f => f.path));

const missing = REQUIRED.filter(p => !shipped.has(p));
if (missing.length > 0) {
  console.error(`refusing to publish: the tarball is missing ${missing.join(", ")}`);
  console.error(`it contains: ${[...shipped].sort().join(", ")}`);
  process.exit(1);
}

// Walk what the entry points actually import. A missing shared chunk passes every
// files-field check and then throws ERR_MODULE_NOT_FOUND in the consumer.
const seen = new Set();
const queue = [...ENTRIES];
const danglingImports = [];

while (queue.length > 0) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);

  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue; // absence is already reported against REQUIRED
  }

  for (const m of source.matchAll(/\bfrom\s*["'](\.[^"']+)["']/g)) {
    const target = path.posix.join(path.posix.dirname(file), m[1]);
    if (!shipped.has(target)) danglingImports.push(`${file} -> ${m[1]}`);
    else queue.push(target);
  }
}

if (danglingImports.length > 0) {
  console.error("refusing to publish: the tarball has imports pointing at files it does not contain");
  for (const d of danglingImports) console.error(`  ${d}`);
  process.exit(1);
}

console.log(
  `verify-pack: ${REQUIRED.length} required paths present, ${seen.size} reachable modules all shipped`,
);
