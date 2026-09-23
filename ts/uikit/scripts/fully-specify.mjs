// Adds the file extension to every relative import in the unbundled build.
//
// `tsup` with `bundle: false` transpiles each module as written, so
// `import { cn } from "../lib/cn"` stays extensionless — which Node's ESM
// resolver and webpack's `fullySpecified` (on for `"type": "module"`
// packages) both refuse. This resolves each specifier against the emitted
// files: `x.js` if it exists, else `x/index.js`, and fails the build on
// anything that is neither.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "dist");
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']+)\2/g;

let rewritten = 0;
for (const rel of readdirSync(root, { recursive: true, encoding: "utf8" })) {
  if (!rel.endsWith(".js")) continue;
  const file = join(root, rel);
  const src = readFileSync(file, "utf8");
  const out = src.replace(SPECIFIER, (match, lead, quote, spec) => {
    if (/\.(m?js|json|css)$/.test(spec)) return match;
    const base = resolve(dirname(file), spec);
    const target = existsSync(`${base}.js`) ? `${spec}.js` : existsSync(join(base, "index.js")) ? `${spec}/index.js` : null;
    if (!target) throw new Error(`${rel}: cannot resolve ${spec}`);
    rewritten++;
    return `${lead}${quote}${target}${quote}`;
  });
  if (out !== src) writeFileSync(file, out);
}
console.log(`fully-specify: ${rewritten} relative imports in ${root}`);
