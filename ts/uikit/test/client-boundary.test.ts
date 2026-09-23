import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The kit ships one file per module (see `tsup.config.ts`), so each module's
// own `"use client"` decides where the server stops. Missing on an interactive
// module, a Server Component rendering it crashes on the first hook; present
// on a static one, it ships to the browser for nothing. This derives the
// answer from what the source does.
const SRC = join(import.meta.dirname, "../src");

const HOOK = /\buse[A-Z]\w*\s*\(|React\.use[A-Z]\w*\s*\(|\buse\(/;
const CONTEXT = /createContext\s*\(/;
// A handler written in the module is a function created during render — a
// Server Component cannot hand one to the DOM.
const HANDLER = /\son[A-Z]\w*=\{/;
const DIRECTIVE = /^\s*["']use client["'];?/;

const modules = readdirSync(SRC, { recursive: true, encoding: "utf8" })
  .filter(f => /\.tsx?$/.test(f) && !f.endsWith(".d.ts") && !f.startsWith("palette") && f !== "index.ts")
  .sort();

describe("the client boundary", () => {
  it("marks exactly the modules that need a browser", () => {
    const wrong = modules.flatMap(rel => {
      const src = readFileSync(join(SRC, rel), "utf8");
      const needs = HOOK.test(src) || CONTEXT.test(src) || HANDLER.test(src);
      const says = DIRECTIVE.test(src);
      if (needs && !says) return [`${rel}: interactive but has no "use client"`];
      if (!needs && says) return [`${rel}: "use client" on a module with no hooks, context or handlers`];
      return [];
    });
    expect(wrong).toEqual([]);
  });

  it("keeps the barrel itself server-safe, so it only re-exports", () => {
    expect(readFileSync(join(SRC, "index.ts"), "utf8")).not.toMatch(DIRECTIVE);
  });

  // `export *` hides which names a module gives, so a bundler resolving
  // `import { Section }` must load every starred module to find out — and each
  // `"use client"` one it loads from a Server Component ships to the browser.
  // Measured on the aquafix landing: 26 KB gz of kit it never rendered.
  it("names every re-export in the barrel, never `export *`", () => {
    expect(readFileSync(join(SRC, "index.ts"), "utf8")).not.toMatch(/^export \*/m);
  });
});
