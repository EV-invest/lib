import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// `FieldLabel` used to recognise the kit's controls by identity, so field.tsx
// imported every one of them and a page with one `Field` and an `Input` shipped
// `Select` too (floating, portal, focus scope, listbox). The controls now mark
// themselves; this holds field's module graph to that.
const PKG = join(import.meta.dirname, "..");
const FIELD_SRC = join(PKG, "src/components/field.tsx");
const FIELD_DIST = join(PKG, "dist/components/field.js");

const IMPORT = /(?:\bfrom|^\s*import)\s*["']([^"']+)["']/gm;

function specifiers(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(IMPORT)].map(m => m[1] ?? "");
}

// The relative modules `entry` reaches, as paths relative to the package.
function graph(entry: string, extensions: readonly string[]): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of specifiers(file).filter(s => s.startsWith("."))) {
      const base = resolve(dirname(file), spec);
      const found = ["", ...extensions].map(ext => base + ext).find(p => existsSync(p) && statSync(p).isFile());
      if (found === undefined) throw new Error(`${relative(PKG, file)}: cannot resolve ${spec}`);
      queue.push(found);
    }
  }
  return [...seen].map(f => relative(PKG, f)).sort();
}

describe("field's module graph", () => {
  it("imports none of the kit's controls in source", () => {
    const controls = /^\.\/(select|input|textarea|native-select|checkbox|switch)$/;
    expect(specifiers(FIELD_SRC).filter(spec => controls.test(spec))).toEqual([]);
  });

  it("does not reach select.tsx through any module in source", () => {
    const reached = graph(FIELD_SRC, [".ts", ".tsx"]);
    // The walk really follows imports: field reaches the mark through one.
    expect(reached).toContain("src/primitives/labelable.ts");
    expect(reached).not.toContain("src/components/select.tsx");
  });

  // `dist/` is the build's output, absent until `npm run build` (or install's
  // `prepare`); the source checks above hold the same line without it.
  it.runIf(existsSync(FIELD_DIST))("does not reach select.js in the built dist", () => {
    const reached = graph(FIELD_DIST, []);
    expect(reached).toContain("dist/primitives/labelable.js");
    expect(reached).not.toContain("dist/components/select.js");
  });
});
