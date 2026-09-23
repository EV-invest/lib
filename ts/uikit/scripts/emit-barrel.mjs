// Re-emits `dist/index.js` from `src/index.ts` with TypeScript, over what tsup
// wrote.
//
// esbuild compiles `export { Button } from "./components/button"` into an
// `import` plus one trailing `export { … }` (it has to, to drop the type-only
// names). The result means the same, but it is no longer a *barrel* to Next:
// `optimizePackageImports` only rewrites a module made of `export … from`
// statements, and without that rewrite a Server Component's
// `import { Section } from "@evinvest/uikit"` reaches every `"use client"`
// module the barrel names — and all of them ship to the browser. TypeScript's
// transpile keeps each re-export as written and elides the type-only ones.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = join(import.meta.dirname, "..");
const { outputText } = ts.transpileModule(readFileSync(join(root, "src/index.ts"), "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    isolatedModules: true,
    removeComments: true,
  },
});
if (/^\s*import\s/m.test(outputText)) throw new Error("emit-barrel: src/index.ts must only re-export");
writeFileSync(join(root, "dist/index.js"), outputText);
// tsup's map described the file this replaces.
rmSync(join(root, "dist/index.js.map"), { force: true });
console.log("emit-barrel: dist/index.js is re-exports only");
