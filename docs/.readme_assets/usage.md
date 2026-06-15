## Layout

| Path | What | Stack |
| ---- | ---- | ----- |
| [`rust/`](rust/) | the `ev` crate — one library per Cargo feature | Rust |
| [`ts/`](ts/) | TypeScript packages — one directory per library | TypeScript |

Each language lives in its own top-level directory so neither toolchain trips
over the other. A thin root `Cargo.toml` workspace anchors the crate (whose
sources live in `rust/`) at the repo root, where the shared CI and tooling run; a
consumer's git dependency still resolves the `ev` package by name. See
[ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Rust: one crate, a feature per library

Each library is a module behind a Cargo feature, so a consumer compiles only what
it enables.

| Feature | What it is |
| --- | --- |
| `architecture` | I/O-free, `wasm32`-safe DDD tactical kernel: typed ids, entities, aggregate roots, repositories, gateways, the unit of work, domain events, specifications |
| `uikit` | dep-light Dioxus UI kit (mirrors `@ev/uikit`): 63 shadcn-semantics components on `dioxus` + `tailwind_fuse`, no `@radix-ui`/`cva`. Ships the shared design tokens (`tokens.css`) |
| `wasm` | opt-in switch layering browser/js backends onto whatever features are enabled |

### Consume it

```toml
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["architecture"] }
```

For a target that also builds to wasm, enable `wasm` **per-target** so native
builds never link browser backends:

```toml
[target.'cfg(target_arch = "wasm32")'.dependencies]
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["architecture", "wasm"] }
```

### Develop & test

cargo runs from the repo root (the workspace anchors the crate in `rust/`); pass
`-p ev` because feature flags aren't allowed at a virtual-workspace root:

```sh
cargo test  -p ev --features architecture
cargo clippy -p ev --features architecture --all-targets -- -D warnings
cargo check -p ev --features "architecture wasm" --target wasm32-unknown-unknown
```

## TypeScript

TS packages live under [`ts/`](ts/), one directory per library, each with its own
`package.json`: [`ts/architecture/`](ts/architecture/) (the DDD kernel) and
[`ts/uikit/`](ts/uikit/) (the dep-light React UI kit mirroring `ev::uikit`).

## Dev shell

`direnv allow` (or `nix develop`) drops you into the flake shell: the Rust
(nightly) + Node toolchains, formatters, and pre-commit hooks. The `.gitignore`,
`rustfmt.toml`, CI workflows, and this README are generated on entry — don't
hand-edit generated files.
