# rust

The `ev` crate's sources — one library per Cargo feature, so a consumer compiles
only what it enables. The thin virtual workspace that anchors the crate for
repo-root tooling is [`../Cargo.toml`](../Cargo.toml).

```
rust/
├── Cargo.toml          the `ev` package
├── src/
│   ├── lib.rs
│   └── architecture/   the `architecture` feature (DDD tactical kernel)
└── tests/              integration tests
```

Each feature mirrors a TypeScript package in [`../ts`](../ts). cargo runs from the
repo root — pass `-p ev` for feature flags. See
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
