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
refined by `optional(v)`, `withDefault(v, 'literal')`, `secret(v)`,
`requiredIn(v, 'production')`.

### Optional here, mandatory in production

The setting that hurts is not the missing required one — that already stops the
boot. It is the optional whose absence is a *silent* no-op: no `SMTP_HOST` means
mail is logged instead of sent, no `SENTRY_DSN` means the alerts never arrive.
`requiredIn` names the profiles where that convenience ends:

```ts
SMTP_HOST: requiredIn(optional(str()), 'production'),
PUBLIC_ORIGIN: requiredIn(withDefault(url(), 'http://localhost:3000'), 'production', 'staging'),
```

```text
invalid settings (1 problem)
  - SMTP_HOST: missing (required when APP_ENV=production)
```

The profile is `APP_ENV` from `runtimeEnv` (empty counts as unset, default
`development`). In a Next.js app pass `profile: process.env.NODE_ENV` instead of
introducing a second, drifting name — and pass it explicitly whenever a `client`
setting uses `requiredIn`, since the browser bundle carries no `APP_ENV`.

### Failing the boot with a useful exit code

`orExit(() => …)` prints the aggregate message and exits `78` (`EX_CONFIG`) on a
`SettingsError`, rethrowing anything else. Exit 1 is indistinguishable from "a
dependency blinked", which a restart fixes; 78 says a restart cannot.

```ts
// instrumentation.ts — before the server accepts traffic
export function register() {
  orExit(() => assertConfig());
}
```

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
- `requiredIn(v, …)` ↔ `#[required_in(…)]`, matched against the same canonical
  `APP_ENV` with the same `development` fallback, checked **before** a default
  applies, and rejected on a setting that is already required everywhere (a
  compile error on the Rust side, a thrown declaration error here). The profile
  semantics are pinned by mirrored tests:
  [`test/profile.node.test.ts`](./test/profile.node.test.ts) ↔
  `rust/src/settings/tests.rs` (`required_in_*`).
- the contract is pinned by mirrored vectors:
  [`test/contract.node.test.ts`](./test/contract.node.test.ts) ↔
  `rust/src/settings/tests.rs` (`mod contract`). Change both sides or neither.

TS-only (browser-bundler concerns, no Rust equivalent): the `server`/`client`
split with `clientPrefix`, the explicit `runtimeEnv` destructure, the `profile`
override, and the `NEXT_PUBLIC_*` client presets. Rust-only: `drift`, a backend
concern (a browser bundle has no environment to drift from).

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
