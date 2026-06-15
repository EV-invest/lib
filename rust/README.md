# rust

The `ev` crate's sources — one library per Cargo feature, so a consumer compiles
only what it enables. The thin virtual workspace that anchors the crate for
repo-root tooling is [`../Cargo.toml`](../Cargo.toml).

```
rust/
├── Cargo.toml          the `ev` package
├── src/
│   ├── lib.rs
│   ├── architecture/   the `architecture` feature (DDD tactical kernel)
│   └── uikit/          the `uikit` feature (dep-light Dioxus UI kit + tokens.css)
└── tests/              integration tests
```

Unlike `architecture`, the `uikit` feature carries runtime deps (`dioxus`,
`tailwind_fuse`) — a UI kit can't be zero-dep. It mirrors the `@ev/uikit`
TypeScript package and ships the shared design tokens; see its rustdoc and
[`../ts/uikit/README.md`](../ts/uikit/README.md).

Each feature mirrors a TypeScript package in [`../ts`](../ts). cargo runs from the
repo root — pass `-p ev` for feature flags. See
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
