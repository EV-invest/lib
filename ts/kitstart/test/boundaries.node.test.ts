import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * What each file promises about where it runs, read off the source. eslint
 * holds the import rules; these hold the two things a lint rule cannot say.
 */
const SRC = join(import.meta.dirname, "../src");
const files = (dir: string) =>
  readdirSync(join(SRC, dir), { recursive: true, encoding: "utf8" })
    .filter(f => /\.tsx?$/.test(f))
    .map(f => ({ path: `${dir}/${f}`, text: readFileSync(join(SRC, dir, f), "utf8") }));

const CLIENT_ONLY = /\buse(State|Effect|Memo|Ref|Callback|Context|Pathname|Params|Reducer)\b|\bon[A-Z][A-Za-z]*=\{/;

describe("the client boundary", () => {
  it("is on exactly the react modules that need it", () => {
    for (const { path, text } of files("react")) {
      const client = text.startsWith('"use client";');
      // A client module that needs nothing client-side is a page paying for it.
      expect(client, path).toBe(CLIENT_ONLY.test(text));
    }
  });

  it("is nowhere else", () => {
    for (const dir of ["core", "server", "next", "proxy"]) {
      for (const { path, text } of files(dir)) expect(text.includes('"use client"'), path).toBe(false);
    }
  });

  it("marks every server module server-only", () => {
    for (const { path, text } of files("server")) expect(text.includes('import "server-only";'), path).toBe(true);
  });

  it("names every re-export: `export *` makes a bundler load a client module to learn its names", () => {
    for (const dir of ["core", "server", "next", "proxy", "react"]) {
      for (const { path, text } of files(dir)) expect(/export \*/.test(text), path).toBe(false);
    }
  });
});

describe("the declared peers", () => {
  it("are what the sources import", () => {
    const manifest = JSON.parse(readFileSync(join(SRC, "../package.json"), "utf8"));
    const imported = new Set<string>();
    for (const dir of ["core", "server", "next", "proxy", "react", "testing", "cli"]) {
      for (const { text } of files(dir)) {
        for (const [, spec = ""] of text.matchAll(/from\s+"([^."][^"]*)"/g)) {
          if (spec.startsWith("node:")) continue;
          const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : (spec.split("/")[0] ?? spec);
          imported.add(name);
        }
        if (text.includes('import "server-only"')) imported.add("server-only");
      }
    }
    expect([...imported].sort()).toEqual(Object.keys(manifest.peerDependencies).sort());
  });
});
