# `@evinvest/settings` — cookbook

End-to-end recipes for every surface of the package. For the API summary and
the parity rules, see [`README.md`](./README.md). The Rust mirror is
[`ev_lib::settings`](../../rust/src/settings); the org's sops/age secrets
workflow is documented once, in its
[GUIDE](../../rust/src/settings/GUIDE.md#secrets-the-sops-boundary) — this file
covers the TS-specific ends of it.

- [The model](#the-model)
- [One settings module per app](#one-settings-module-per-app)
- [Next.js: validate at build time](#nextjs-validate-at-build-time)
- [The server/client split](#the-serverclient-split)
- [Secrets at the boundary](#secrets-at-the-boundary)
- [Presets — the canonical names](#presets--the-canonical-names)
- [Testing](#testing)
- [Gotchas](#gotchas)

## The model

- **Declaration** — `createSettings({ server, client, clientPrefix, runtimeEnv })`
  validates eagerly and returns a typed, read-only object.
- **Parsing** — validators define how one string becomes one value; `optional` /
  `withDefault` / `secret` mirror the Rust field grammar (`Option<T>`,
  `= "lit"`, `#[secret]`).
- **Injection** — who puts values into `process.env` is not the package's
  business: direnv + sops in dev, `SOPS_AGE_KEY` in CI, the platform in prod.
  Apps stay sops-unaware.

## One settings module per app

Declare once, import everywhere; module-scope evaluation makes a bad
environment fail the process start instead of the first request:

```ts
// src/settings.ts
import { createSettings, port, secret, str, url, withDefault } from '@evinvest/settings';

export const settings = createSettings({
  server: {
    DATABASE_URL: url(),
    PORT: withDefault(port(), '8080'),
    SMTP_PASSWORD: secret(str()),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: process.env.PORT,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  },
});
```

On the server a bare spread of `process.env` works too — but keep the explicit
destructure anyway, so adding a client var later doesn't silently skip
inlining.

## Next.js: validate at build time

Import the settings module from `next.config.*` — the config evaluates during
`next build`, so a broken environment fails CI, not production boot:

```ts
// next.config.ts
import './src/settings';
export default { /* … */ };
```

`NEXT_PUBLIC_*` values are inlined by the compiler **only** as static member
expressions — this is why `runtimeEnv` exists and why it must be written out:

```ts
runtimeEnv: {
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY, // inlined ✓
  // ...spread of process.env would be undefined in the browser ✗
}
```

## The server/client split

```ts
export const settings = createSettings({
  server: { SESSION_REDIS_URL: url() },
  clientPrefix: 'NEXT_PUBLIC_',
  client: { NEXT_PUBLIC_APP_ENV: withDefault(str(), 'development') },
  runtimeEnv: { /* … */ },
});
```

- Client keys **must** start with `clientPrefix`; a server key that starts with
  it is rejected (it would read like a public var while staying server-only).
- On the client only the `client` schema is validated — server values never
  reach the bundle, and `settings.SESSION_REDIS_URL` **throws** there instead
  of returning `undefined`.
- Environment detection is "no `window` in `globalThis`"; pass `isServer`
  explicitly in workers/exotic runtimes.

## Secrets at the boundary

The full sops/age workflow (keys, `.sops.yaml`, direnv, CI, rotation) is in the
[Rust GUIDE](../../rust/src/settings/GUIDE.md#secrets-the-sops-boundary) — it
is language-agnostic. The TS-specific ends:

```sh
# dev: run the app with decrypted values injected; nothing on disk
sops exec-env secrets/dev.enc.env 'npm run dev'
```

```yaml
# CI: the age private key is the only real secret
- uses: nhedger/setup-sops@v2
- run: sops exec-env secrets/dev.enc.env 'npm test'
  env:
    SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}
```

Never ship decryption to the browser: anything a client bundle needs is
`NEXT_PUBLIC_*`, inlined at build time, and therefore public by definition —
secrets are server settings.

## Presets — the canonical names

The org-wide fix for `POSTHOG_KEY` vs `POSTHOG_API_KEY` vs
`NEXT_PUBLIC_POSTHOG_KEY`: the shared names are declared **once**:

```ts
import { createSettings, presets } from '@evinvest/settings';

export const settings = createSettings({
  server: { ...presets.posthog(), ...presets.sentry(), ...presets.appEnv() },
  clientPrefix: 'NEXT_PUBLIC_',
  client: { ...presets.posthogClient(), ...presets.sentryClient() },
  runtimeEnv: { /* … */ },
});
```

Wire them straight into the sibling packages: `settings.POSTHOG_KEY` →
`@evinvest/analytics`, `settings.SENTRY_DSN` → `@evinvest/error-monitoring`.
The libraries stay uncoupled — the edge lives in your app, same as the
experiments↔analytics bridge.

## Testing

`runtimeEnv` is already an injected record — pass a literal:

```ts
import { describe, expect, it } from 'vitest';
import { createSettings, str } from '@evinvest/settings';

it('boots with a minimal env', () => {
  const settings = createSettings({
    server: { DATABASE_URL: str() },
    runtimeEnv: { DATABASE_URL: 'postgres://localhost/test' },
    isServer: true, // pin it — vitest node env has no window either way
  });
  expect(settings.DATABASE_URL).toBe('postgres://localhost/test');
});
```

Assert failures through the typed error:

```ts
import { SettingsError } from '@evinvest/settings';

try {
  createSettings({ server: { DATABASE_URL: str() }, runtimeEnv: {}, isServer: true });
} catch (error) {
  const issues = (error as SettingsError).issues;
  expect(issues).toContainEqual({ key: 'DATABASE_URL', kind: 'missing' });
}
```

Keep one test that builds your real settings module from an empty env — it
catches unparsable `withDefault` literals, which only surface when used.

## Gotchas

- **Evaluate at module scope.** A `createSettings` call inside a request
  handler turns a config bug into a 500 instead of a failed deploy.
- **Don't read `process.env` elsewhere.** The settings object is the one typed
  door; stray `process.env.X` reads bypass validation and the naming contract.
- **`secret(v)` is not a runtime shield.** It redacts library output only;
  logging the value yourself still leaks it.
- **Empty string is unset** (contract). Opt out per call with
  `emptyStringAsUnset: false` if you truly need `VAR=` ≠ unset — the Rust side
  has no such opt-out, so prefer not to.
- **`list` wraps the list, not the item:** `secret(list())`, not
  `list(secret(str()))`.
