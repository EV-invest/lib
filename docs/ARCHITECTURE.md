# Architecture

`EV-invest/lib` is the organisation's **shared-library monorepo**. Its centre of
gravity is one thing expressed in two languages: a generic, I/O-free **DDD
tactical kernel**. The Rust crate is the source of truth; the TypeScript packages
mirror its _semantics_ idiomatically.

## Layout

```
lib/                 (repo: EV-invest/lib)
├── Cargo.toml       thin virtual workspace — anchors the crate at the repo root
├── rust/            the `ev` crate (sources); one library per Cargo feature
│   ├── Cargo.toml
│   ├── src/{lib.rs, architecture/}
│   └── tests/
├── ts/              TypeScript packages, one directory per library
│   └── architecture/
├── docs/
│   ├── ARCHITECTURE.md          (this file)
│   └── .readme_assets/          README fragments (README.md is generated)
└── flake.nix        v_flakes dev shell + generated CI / README / configs
```

Each language owns a top-level directory (`rust/`, `ts/`) so neither toolchain
trips over the other. The shared tooling (CI, formatters, lint config) drives
`cargo` from the repo root, so a **thin virtual workspace** at `./Cargo.toml`
anchors the crate there while its sources stay in `rust/`. The crate is still a
single package: a consumer's git dependency resolves `ev` **by name**, regardless
of the subdirectory.

```toml
# native
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["architecture"] }
```

## The `architecture` kernel

Generic DDD building blocks every bounded context implements. Deliberately
I/O-free and `wasm32`-safe; concrete adapters (sqlx, an external ledger, …) live
in the consuming service.

| Trait / type (Rust)           | TypeScript form                   | Role                                                                             | Object-safe (Rust)?  |
| ----------------------------- | --------------------------------- | -------------------------------------------------------------------------------- | -------------------- |
| `Id<Tag, U>` / `Identifier`   | branded primitive `Id<Tag, U>`    | typed identity — a `TransferId` can't be passed where an `AccountId` is expected | no (always concrete) |
| `Entity` / `AggregateRoot`    | `interface`                       | stable identity; the transactional consistency boundary                          | no                   |
| `Repository` / `Reader`       | `interface` (phantom-bound)       | marker ports tying a port to one aggregate (CRUD lives on the leaf)              | yes                  |
| `Gateway`                     | `interface` (marker)              | anti-corruption boundary to an external transactional system                     | yes                  |
| `UnitOfWork`                  | `interface` (`Promise`)           | one atomic transaction; `commit`/`rollback` are terminal                         | yes                  |
| `DomainEvent` / `EmitsEvents` | discriminated union / `interface` | past-tense facts; defined, not yet wired (future outbox)                         | no                   |
| `Specification<T>`            | `interface` + combinators         | composable in-memory predicate                                                   | yes (core method)    |

## Consistency boundaries — Repository vs Gateway

Two independent consistency boundaries, encoded in the type system:

- A `UnitOfWork` is exactly one SQL (e.g. Postgres) transaction; repositories
  enroll in it.
- A `Gateway` is an external system (a ledger, a payment API). It is **never** a
  `Repository` and is **unreachable** from a `UnitOfWork` (there is no
  `UnitOfWork::gateway()`), so the type system forbids enrolling it in a local
  transaction. It owns its own identity, invariants, and atomicity.

Any operation spanning both is an explicit application-layer saga, not an atomic
transaction. The intended future mechanism is a `DomainEvent` written to an
outbox **inside the same `UnitOfWork`** as the state change — which is why
`DomainEvent` exists but is unwired today.

## Cross-language parity

The TS packages are not line-by-line translations; they preserve the _semantics_
of the Rust public API while reading like idiomatic TS. The full mapping and the
intentional divergences (errors, numbers, serialization) are the source of truth
in [`ts/architecture/README.md`](../ts/architecture/README.md). The load-bearing
ones:

- **Numbers** — `u64`/`u128` and anything precision-sensitive map to `bigint`,
  never `number` (an f64 loses precision past 2⁵³). Numeric ids are `bigint`.
- **Errors** — `Option<T>` → `T | undefined`; the one fallible async op
  (`UnitOfWork`) rejects its `Promise` (throws) rather than returning a `Result`.
- **Typed ids** — branded primitives, so `===` and `Map`/`Set` keys work
  natively; no `underlying()` indirection.

## Source of truth

- The **Rust crate is canonical**. When the kernel's behaviour changes, change
  Rust first, then bring the TS port back into parity. The TS README's mapping
  table is the contract between the two.
- A new library = a Rust module behind a Cargo feature **and** (if it has a TS
  consumer) a package under `ts/`. Keep the feature name and the package name in
  step (`architecture` ↔ `ts/architecture`).

