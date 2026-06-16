# ev
![Minimum Supported Rust Version](https://img.shields.io/badge/nightly-1.92+-ab6000.svg)
[<img alt="crates.io" src="https://img.shields.io/crates/v/ev.svg?color=fc8d62&logo=rust" height="20" style=flat-square>](https://crates.io/crates/ev)
[<img alt="docs.rs" src="https://img.shields.io/badge/docs.rs-66c2a5?style=for-the-badge&labelColor=555555&logo=docs.rs&style=flat-square" height="20">](https://docs.rs/ev)

[<img alt="TypeScript: strict" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white&style=flat-square" height="20">](ts/architecture)
<img alt="module: ESM only" src="https://img.shields.io/badge/module-ESM_only-f7df1e?logo=javascript&logoColor=black&style=flat-square" height="20">
<img alt="Node 20+" src="https://img.shields.io/badge/node-%E2%89%A520-339933?logo=nodedotjs&logoColor=white&style=flat-square" height="20">
<img alt="runtime deps: 0" src="https://img.shields.io/badge/runtime_deps-0-44cc11?style=flat-square" height="20">
<img alt="WebAssembly" src="https://img.shields.io/badge/WebAssembly-654FF0?logo=webassembly&logoColor=white" height="20">

EV-invest's shared libraries — a polyglot monorepo. Each library is opt-in, so a
consumer pulls in only what it asks for: a Cargo feature on the Rust side, a
package under `ts/` on the TypeScript side.

## Usage
### Layout

| Path | What | Stack |
| ---- | ---- | ----- |
| [`rust/`](rust/) | the `ev` crate — one library per Cargo feature | Rust |
| [`ts/`](ts/) | TypeScript packages — one directory per library | TypeScript |

Each language lives in its own top-level directory so neither toolchain trips
over the other. A thin root `Cargo.toml` workspace anchors the crate (whose
sources live in `rust/`) at the repo root, where the shared CI and tooling run; a
consumer's git dependency still resolves the `ev` package by name. See
[ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Rust: one crate, a feature per library

Each library is a module behind a Cargo feature, so a consumer compiles only what
it enables.

| Feature | What it is |
| --- | --- |
| `architecture` | I/O-free, `wasm32`-safe DDD tactical kernel: typed ids, entities, aggregate roots, repositories, gateways, the unit of work, domain events, specifications |
| `uikit` | dep-light Dioxus UI kit (mirrors `@evinvest/uikit`): 63 shadcn-semantics components on `dioxus` + `tailwind_fuse`, no `@radix-ui`/`cva`. Ships the shared design tokens (`tokens.css`) |
| `wasm` | opt-in switch layering browser/js backends onto whatever features are enabled |

#### Consume it

```toml
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["architecture"] }
```

For a target that also builds to wasm, enable `wasm` **per-target** so native
builds never link browser backends:

```toml
[target.'cfg(target_arch = "wasm32")'.dependencies]
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["architecture", "wasm"] }
```

#### Develop & test

cargo runs from the repo root (the workspace anchors the crate in `rust/`); pass
`-p ev` because feature flags aren't allowed at a virtual-workspace root:

```sh
cargo test  -p ev --features architecture
cargo clippy -p ev --features architecture --all-targets -- -D warnings
cargo check -p ev --features "architecture wasm" --target wasm32-unknown-unknown
```

### TypeScript

TS packages live under [`ts/`](ts/), one directory per library, each with its own
`package.json`: [`ts/architecture/`](ts/architecture/) (the DDD kernel) and
[`ts/uikit/`](ts/uikit/) (the dep-light React UI kit mirroring `ev::uikit`).

### Dev shell

`direnv allow` (or `nix develop`) drops you into the flake shell: the Rust
(nightly) + Node toolchains, formatters, and pre-commit hooks. The `.gitignore`,
`rustfmt.toml`, CI workflows, and this README are generated on entry — don't
hand-edit generated files.

<!-- Per-library details live in each package's own README (Rust feature docs; ts/<pkg>/README.md). -->


<br>

<sup>
	This repository follows <a href="https://github.com/valeratrades/.github/tree/master/best_practices">my best practices</a> and <a href="https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md">Tiger Style</a> (except "proper capitalization for acronyms": (VsrState, not VSRState) and formatting). For project's architecture, see <a href="./docs/ARCHITECTURE.md">ARCHITECTURE.md</a>.
</sup>

#### License

<sup>
	Licensed under <a href="LICENSE">Blue Oak 1.0.0</a>
</sup>

<br>

<sub>
	Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this crate by you, as defined in the Apache-2.0 license, shall
be licensed as above, without any additional terms or conditions.
</sub>

