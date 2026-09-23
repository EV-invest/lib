import tseslint from "typescript-eslint";

// The subpaths are runtimes, and each promises what it will not pull in. The
// promise is checked here, per directory, rather than trusted to review:
//
//   core   → nothing but @evinvest/*  (edge, client and server import it)
//   proxy  → core, next/server        (edge)
//   server → core, node:*             (server-only)
//   next   → core, server, next/*, react
//   react  → core, @evinvest/*, react, next/navigation — never server or next
const RUNTIME = ["node:*", "next", "next/*", "react", "react/*", "react-dom", "react-dom/*", "server-only"];
const layer = (name) => [`../${name}`, `../${name}/*`, `../../${name}`, `../../${name}/*`];

const restrict = (patterns) => ({ "no-restricted-imports": ["error", { patterns }] });

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "template/**", "test/visual/dist/**"] },
  ...tseslint.configs.recommended,
  {
    // `_x` is a parameter a signature needs and the body does not read.
    rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
  {
    files: ["src/core/**", "src/index.ts"],
    rules: restrict([
      { group: RUNTIME, message: "the core runs anywhere: no React, Next or node:*" },
      { group: [...layer("server"), ...layer("next"), ...layer("proxy"), ...layer("react"), ...layer("testing")], message: "the core imports no other layer" },
    ]),
  },
  {
    files: ["src/proxy/**"],
    rules: restrict([
      { group: ["node:*", "react", "react/*", "server-only", "next/headers*", "next/navigation*"], message: "the proxy runs on the edge" },
      { group: [...layer("server"), ...layer("next"), ...layer("react")], message: "the proxy reads only the core" },
    ]),
  },
  {
    files: ["src/server/**"],
    rules: restrict([
      { group: ["next", "next/*", "react", "react/*", "react-dom"], message: "the server layer is framework-free" },
      { group: [...layer("next"), ...layer("proxy"), ...layer("react")], message: "the server layer reads only the core" },
    ]),
  },
  {
    files: ["src/react/**"],
    rules: restrict([
      { group: ["node:*", "server-only", "next/server*", "next/headers*", "next/og*"], message: "react widgets render on either side" },
      { group: [...layer("server"), ...layer("next"), ...layer("proxy")], message: "react widgets never reach the server or next layers" },
    ]),
  },
);
