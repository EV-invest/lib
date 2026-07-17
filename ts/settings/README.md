# `@evinvest/settings`

Typed, validated env settings with aggregate error reporting and a
server/client split — **zero runtime dependencies**, one server-safe,
browser-safe ESM entry. The TypeScript mirror of the `settings` Cargo feature
of [`ev_lib`](../../rust/src/settings).

> This package reads **environment variables only** — no config files, no hot
> reload, and no decryption: secrets management stays at the shell/CI boundary
> (sops + age). See the [GUIDE](./GUIDE.md) and the Rust
> [GUIDE](../../rust/src/settings/GUIDE.md#secrets-the-sops-boundary) for the
> full sops workflow.

## Install

```sh
npm i @evinvest/settings
```

## Usage

One `settings.ts` per app, evaluated at module scope so a bad environment fails
the boot — and, imported from `next.config.*`, the build:

```ts
import { createSettings, list, port, presets, secret, str, url, withDefault } from '@evinvest/settings';

export const settings = createSettings({
  server: {
    SESSION_REDIS_URL: url(),
    PORT: withDefault(port(), '8080'),
    BANKING_ISSUANCE_TOKEN: secret(str()),
    MFE_ALLOWED_ORIGINS: withDefault(list(), ''),
    ...presets.posthog(), // POSTHOG_KEY / POSTHOG_HOST, canonical names
  },
  clientPrefix: 'NEXT_PUBLIC_',
  client: {
    ...presets.posthogClient(), // NEXT_PUBLIC_POSTHOG_KEY / _HOST
  },
  // explicit destructure: bundlers inline NEXT_PUBLIC_* / import.meta.env.*
  // only for static member expressions
  runtimeEnv: {
    SESSION_REDIS_URL: process.env.SESSION_REDIS_URL,
    PORT: process.env.PORT,
    BANKING_ISSUANCE_TOKEN: process.env.BANKING_ISSUANCE_TOKEN,
    MFE_ALLOWED_ORIGINS: process.env.MFE_ALLOWED_ORIGINS,
    POSTHOG_KEY: process.env.POSTHOG_KEY,
    POSTHOG_HOST: process.env.POSTHOG_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
});

settings.PORT;                    // number — typed, validated
settings.POSTHOG_KEY;             // string | undefined (optional)
// on the client: settings.SESSION_REDIS_URL throws (server-only)
```

A missing/invalid environment throws one `SettingsError` listing **every**
problem:

```text
invalid settings (2 problems)
  - SESSION_REDIS_URL: missing
  - PORT: invalid value "banana": expected a finite number
```

Validators: `str`, `num`, `int`, `port`, `bool`, `url`, `list`, `oneOf` —
refined by `optional(v)`, `withDefault(v, 'literal')`, `secret(v)`.

## Rust ↔ TS parity

The Rust crate is the source of truth; this package preserves its *semantics*.
The full mapping table lives in the Rust
[README](../../rust/src/settings/README.md#rust--ts-parity); the load-bearing
shared rules:

- var names are written-out SCREAMING_SNAKE keys; required by default;
  `optional(v)` ↔ `Option<T>`; `withDefault(v, lit)` ↔ `= "lit"` (the literal
  parses by the same rules, only when unset).
- the **empty string is unset**; `bool` accepts `true`/`false`/`1`/`0`
  case-insensitively; `list` splits on `,`, trims items, drops empty items;
  scalars are **not** trimmed; number grammar matches Rust `FromStr` (`int`:
  plain decimal; `num`: decimal/point/exponent, no hex). Documented
  divergences: JS numbers are doubles, so `num()` requires finite values
  (Rust `f64` also accepts `inf`/`NaN`) and `int()` stops at the safe range
  `±(2^53 - 1)` — use `str()` for 64-bit ids.
- errors aggregate into one `SettingsError` (message shape shared with the
  Rust `Display` impl); `secret(v)` redacts values in error output.
- the contract is pinned by mirrored vectors:
  [`test/contract.node.test.ts`](./test/contract.node.test.ts) ↔
  `rust/src/settings/tests.rs` (`mod contract`). Change both sides or neither.

TS-only (browser-bundler concerns, no Rust equivalent): the `server`/`client`
split with `clientPrefix`, the explicit `runtimeEnv` destructure, and the
`NEXT_PUBLIC_*` client presets.

## Limitations

- **Env-only, flat.** No config files, no `__` nesting — by design.
- **`runtimeEnv` must destructure explicitly** for client vars: bundlers
  (Next.js `NEXT_PUBLIC_*`, Vite `import.meta.env`) inline only static member
  expressions at build time.
- **`secret(v)` redacts what the library emits** (errors/issues). JS has no
  `Debug` boundary — `console.log(settings.TOKEN)` still prints the value
  (unlike Rust, where the generated `Debug` prints `***`).
- **Worker runtimes:** the default server detection is "no `window` in
  `globalThis`" — pass `isServer` explicitly in web workers.

## Develop

```sh
npm run typecheck && npm test && npm run build
```
