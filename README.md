# ev

EV-invest's shared libraries — a polyglot monorepo. Each library is opt-in, so a
consumer pulls in only what it asks for.

## Layout

```
lib/                 (repo: EV-invest/lib)
├── flake.nix        v_flakes devshell (generates .gitignore/.gitattributes on entry)
├── .envrc           direnv: activate the flake at repo root only
├── Cargo.toml       the `ev` crate — one library per Cargo feature
├── src/
│   ├── lib.rs
│   └── architecture/   ← the `architecture` feature
├── tests/
└── ts/              all TypeScript (one package per library)
```

The Rust crate sits at the repo root; TypeScript packages live under `ts/`, so
neither toolchain trips over the other. It is a single crate, so there is no
Cargo workspace — a consumer's git dependency resolves the `ev` package straight
from the root manifest.

## Rust: one crate, a feature per library

The Rust side is a single crate (`ev`) where each library is a module behind a
feature flag. Add a library = add a `#[cfg(feature = "…")] pub mod …;` plus a
`[features]` entry that gates its dependencies.

| Feature | What it is |
| --- | --- |
| `architecture` | I/O-free, `wasm32`-safe DDD tactical kernel: typed ids, entities, aggregate roots, repositories, gateways, the unit of work, domain events, specifications |
| `wasm` | opt-in switch that layers browser/js backends onto whatever other features are enabled |

### Consume it

```toml
# native
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["architecture"] }
```

For a target that also builds to wasm (e.g. a Dioxus frontend), turn on `wasm`
**per-target** so native builds never link browser backends:

```toml
[target.'cfg(target_arch = "wasm32")'.dependencies]
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["architecture", "wasm"] }
```

### Develop & test

```sh
cargo test  --features architecture                       # unit + integration + doctests
cargo clippy --features architecture --all-targets -- -D warnings
cargo check --features "architecture wasm" --target wasm32-unknown-unknown
```

## TypeScript

TS packages go under [`ts/`](./ts), one directory per library. See
[`ts/README.md`](./ts/README.md).

## Dev shell

`direnv allow` (or `nix develop`) drops you into the flake shell, which provides
the Rust + Node toolchains and regenerates `.gitignore`/`.gitattributes` from
[v_flakes](https://github.com/valeratrades/v_flakes) on entry — don't hand-edit
the root `.gitignore`; it is overwritten.
