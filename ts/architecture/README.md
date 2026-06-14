# @ev/architecture

A generic, I/O-free **DDD tactical kernel** for TypeScript: typed ids, entities,
aggregate roots, domain events, repositories, gateways, the unit of work, and
specifications. It is the TypeScript port of the `architecture` feature of the
[`ev`](https://github.com/EV-invest/lib) Rust crate, and preserves the _semantics_
of that public API while reading like idiomatic TS.

Zero runtime dependencies. ESM-only. Strict types.

## Install

This package lives in a subdirectory of a polyglot monorepo. npm has no native
support for installing a git **subdirectory**, so the plain `github:` shorthand
won't resolve it on its own. Two working options:

```sh
# 1. Pin the subdirectory via gitpkg (resolves ts/architecture and runs its build):
npm i 'https://gitpkg.vercel.app/EV-invest/lib/ts/architecture?<tag-or-sha>'

# 2. If this package is later split into its own repo, the canonical form applies:
npm i 'github:EV-invest/architecture#<tag>'
```

`dist/` is **not** committed; the package's `prepare` script builds it (via tsup)
when it is installed from git. Requires Node ≥ 20.

## Usage

```ts
import { Id, spec, assertNever } from "@ev/architecture";
import type { AggregateRoot, Repository, Reader, UnitOfWork, DomainEvent } from "@evt/architecture";

// --- Typed ids: distinct tags are incompatible at compile time ---------------
type OrderId = Id<"order", bigint>; // numeric id → bigint, never number
type UserId = Id<"user">; // defaults to a string UUID

const o = Id.fromRaw<"order", bigint>(1n);
Id.raw(o); // 1n
const u = Id.newUuid<"user">(); // fresh v4 UUID
// debit(o) where debit(_: UserId) ⇒ compile error

// --- Aggregate + ports -------------------------------------------------------
interface Order extends AggregateRoot<OrderId> {
  readonly totalCents: bigint;
}

interface OrderRepository extends Repository<Order>, Reader<Order> {
  create(order: Order): void;
  find(id: OrderId): Order | undefined; // Rust Option<Order> → T | undefined
}

// --- Specifications: compose rules, accept bare predicates -------------------
const expensive = spec((o: Order) => o.totalCents >= 10_000n);
const featured = expensive.and((o) => o.id === Id.fromRaw<"order", bigint>(1n));
featured.holds(order);

// --- Domain events: discriminated unions, exhaustively handled ---------------
type OrderEvent =
  | { kind: "order.placed"; orderId: OrderId }
  | { kind: "order.cancelled"; reason: string };

function describe(e: OrderEvent): string {
  switch (e.kind) {
    case "order.placed":
      return "placed";
    case "order.cancelled":
      return `cancelled: ${e.reason}`;
    default:
      return assertNever(e); // compile error if a variant is added
  }
}

// --- Unit of work: failure rejects the promise -------------------------------
async function run(uow: UnitOfWork) {
  try {
    // … do work …
    await uow.commit();
  } catch {
    await uow.rollback();
  }
}
```

## Differences from the Rust version

The behaviour of the public API is the same; the shapes are idiomatic TS. The
intentional divergences:

| Area                            | Rust                                 | TypeScript                                                                                       | Why                                                                                                                                                                     |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Typed id**                    | `Id<Tag, U>` phantom newtype         | branded primitive `Id<Tag, U>`                                                                   | TS has no newtypes; the value _is_ the primitive, so `===` and `Map`/`Set` keys work natively — no `underlying()` indirection.                                          |
| **Numbers**                     | `u64` / `u128` ids                   | `bigint` (default underlying is `string` UUID)                                                   | `number` is an f64 and silently loses precision past 2⁵³. Financial/id values must be `bigint`.                                                                         |
| **Id serialization**            | `#[serde(transparent)]` → bare value | string ids are `JSON.stringify`-transparent; **bigint ids are not**                              | `JSON.stringify` throws on `bigint`, and JSON numbers > 2⁵³ lose precision in JS. Encode bigint ids as **strings** on the wire (`Id.raw(id).toString()` / `BigInt(s)`). |
| **Errors**                      | `Result<T, E>` / `Option<T>`         | `Option<T>` → `T \| undefined`; the one fallible op (`UnitOfWork`) **throws** (rejected promise) | The kernel exposes no fallible value-returning API; for async I/O, throwing is the idiomatic TS shape, so no `Result` union is exported.                                |
| **`match`**                     | exhaustive `match`                   | `switch` + `assertNever(x: never)`                                                               | Same exhaustiveness guarantee, enforced at compile time.                                                                                                                |
| **`AggregateRoot::NAME`**       | compile-time `const` (no instance)   | `readonly name` instance member                                                                  | Interfaces can't ergonomically require statics. Expose a `static NAME` on your class too if you need it instance-free.                                                  |
| **Traits / markers**            | `trait` + object safety              | `interface` (+ phantom binding on repos)                                                         | TS interfaces are structural; ports carry a phantom `aggregate?` so `Repository<A>` stays distinct per aggregate.                                                       |
| **`Specification` combinators** | `And`/`Or`/`Not` structs             | closures via `spec().and/or/not` (+ free `and`/`or`/`not`)                                       | Same observable `holds` behaviour; any `(c) => boolean` is accepted, mirroring Rust's blanket `Fn` impl.                                                                |
| **`UnitOfWork` consumption**    | `self: Box<Self>` (move)             | terminal-by-contract                                                                             | TS has no move semantics; reuse-after-commit is a documented contract, optionally guarded at runtime.                                                                   |
| **wasm gating**                 | `Id::new` gated off wasm             | `Id.newUuid` uses Web Crypto everywhere                                                          | `globalThis.crypto.randomUUID()` works on Node and in the browser; minting is still a host concern.                                                                     |

## Develop

```sh
npm install        # also builds via `prepare`
npm run typecheck  # tsc --noEmit (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes)
npm test           # vitest
npm run build      # tsup → dist/ (ESM + .d.ts + sourcemaps)
```
