# ts

TypeScript libraries — one directory per package, each self-contained with its
own `package.json`, built ESM-only with `tsup` and tested with `vitest`.

```
ts/
├── architecture/   port of the `architecture` Cargo feature (DDD kernel)
└── uikit/          port of the `uikit` Cargo feature (dep-light React UI kit)
```

Each package mirrors the _semantics_ of its Rust counterpart in
[`../rust`](../rust); see the package's own README for the Rust↔TS mapping.
`node_modules/`, `dist/`, and `*.tsbuildinfo` are git-ignored.
