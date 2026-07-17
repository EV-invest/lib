# `ev_lib::settings` — cookbook

End-to-end recipes for the `settings` feature, including the org's sops/age
secrets workflow (which is deliberately **outside** the library). For the API
summary and the parity table, see [`README.md`](./README.md). The TS mirror is
[`@evinvest/settings`](../../../ts/settings).

- [The model](#the-model)
- [Declare settings](#declare-settings)
- [The contract](#the-contract)
- [Secrets: the sops boundary](#secrets-the-sops-boundary)
- [Presets — the canonical names](#presets--the-canonical-names)
- [Testing](#testing)
- [Migrating from `v_utils` LiveSettings](#migrating-from-v_utils-livesettings)
- [Gotchas](#gotchas)

## The model

Three layers, only the first two in this library:

1. **Declaration** — `settings!` generates the struct, `from_env`/`from_source`,
   `var_names`, and a secret-redacting `Debug`.
2. **Parsing** — [`FromEnvValue`](./value.rs) implementations define how one
   string becomes one typed value; the helpers in [`mod.rs`](./mod.rs) define
   lookup (empty = unset), defaults, and error aggregation.
3. **Injection** — *who puts the variables into the environment* is not the
   library's business: direnv + sops in dev, `sops exec-env` ad hoc,
   `SOPS_AGE_KEY` in CI, sops-nix on hosts. Apps stay sops-unaware.

## Declare settings

One `settings.rs` per service, one call to `from_env` at startup, fail fast:

```rust
ev_lib::settings! {
	pub struct AppSettings, prefix = "CABINET" {
		bind: std::net::SocketAddr = "127.0.0.1:8080",
		session_redis_url: String,
		#[secret]
		banking_issuance_token: String,
		#[env("POSTHOG_KEY")]
		posthog_key: Option<String>,
	}
}

let settings = AppSettings::from_env().unwrap_or_else(|error| {
	// one message listing EVERY problem — fix the whole list in one edit
	eprintln!("{error}");
	std::process::exit(78); // EX_CONFIG
});
```

Custom types parse via their `FromStr`:

```rust
ev_lib::settings_via_from_str!(MyPlane); // MyPlane: FromStr

ev_lib::settings! {
	pub struct PlaneSettings {
		plane: MyPlane,
	}
}
```

`var_names()` makes the `.env.example` write itself:

```rust
for var in AppSettings::var_names() {
	println!("{var}=");
}
```

## The contract

Shared with `@evinvest/settings` and pinned by mirrored test vectors
(`tests.rs` `mod contract` ↔ `test/contract.node.test.ts`):

| Rule | Behaviour |
| --- | --- |
| naming | SHOUTY field name; `prefix = "APP"` → `APP_…`; `#[env("NAME")]` is the final name (prefix not applied) |
| required | default; `Option<T>` opts out; `= "literal"` defaults (literal parsed by the same rules, only when unset) |
| empty string | **unset** — `VAR=` behaves exactly like no `VAR` |
| `bool` | `true`/`false`/`1`/`0`, ASCII case-insensitive, no trimming |
| lists | split on `,`, trim items, drop empty items (`"a, b ,,c"` → `a`,`b`,`c`) |
| scalars | **not** trimmed — `" 8080"` is not a number |
| errors | aggregate: one error lists every missing/invalid var; declaration order |
| secrets | `#[secret]` — `Debug` prints `***`; errors never show the value (a bad *default* is shown — it lives in source code) |

## Secrets: the sops boundary

The library reads env vars; [sops](https://github.com/getsops/sops) (with
[age](https://age-encryption.org) keys) is how the *values* travel — encrypted
in git, decrypted only at the boundary. Apps never link a sops library.

**One-time, per human (and one for CI):**

```sh
age-keygen -o ~/.config/sops/age/keys.txt   # prints: Public key: age1…
```

**Per repo:** commit `.sops.yaml` listing the recipients, and the encrypted
env file (never the plaintext one):

```yaml
# .sops.yaml
creation_rules:
  - path_regex: (^|/)secrets/.*\.enc\.env$
    age: >-
      age1exampledeveloperkey…,
      age1examplecikey…
```

```sh
# --filename-override matches the *.enc.env creation rule while reading the
# plaintext file (rules select on the input path otherwise)
sops encrypt --filename-override secrets/dev.enc.env secrets/dev.env > secrets/dev.enc.env && rm secrets/dev.env
sops edit secrets/dev.enc.env        # $EDITOR on plaintext, re-encrypts on save
```

**Dev shell (direnv):** decrypt into the direnv environment on entry —

```sh
# .envrc
use flake
eval "$(sops -d --output-type dotenv secrets/dev.enc.env | direnv dotenv bash /dev/stdin)"
watch_file secrets/dev.enc.env
```

— or keep the shell clean and inject per command (nothing lands on disk, the
parent shell never sees the values):

```sh
sops exec-env secrets/dev.enc.env 'cargo run'
```

**CI (GitHub Actions):** the age *private* key is the one real secret; store it
as `SOPS_AGE_KEY` and everything else stays in git:

```yaml
- uses: nhedger/setup-sops@v2
- run: sops exec-env secrets/dev.enc.env 'cargo test'
  env:
    SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}
```

**Key hygiene:** onboarding = add the recipient to `.sops.yaml` +
`sops updatekeys secrets/*.enc.env`. Offboarding = remove the recipient +
`updatekeys` + `sops rotate -i` **and rotate the underlying credentials** — git
history is forever, an ex-recipient could already decrypt every old revision.
Values containing `$` are mangled by the direnv pattern (direnv#1278) — prefer
`sops exec-env` for those.

## Presets — the canonical names

The org-wide fix for `POSTHOG_KEY` vs `POSTHOG_API_KEY` vs
`NEXT_PUBLIC_POSTHOG_KEY`: the shared names are declared **once**, here.

```rust
use ev_lib::settings::presets::{AppEnv, Posthog, Sentry};

let posthog = Posthog::from_env()?; // POSTHOG_KEY / POSTHOG_HOST, both optional
let sentry = Sentry::from_env()?;   // SENTRY_DSN, optional
let app_env = AppEnv::from_env()?;  // APP_ENV, defaults to "development"
```

Load presets next to your app struct; don't re-declare their variables. The TS
package additionally ships the `NEXT_PUBLIC_*` client variants — a browser
bundler concern with no Rust equivalent.

## Testing

`from_source` takes any `FnMut(&str) -> Option<String>`, so tests never touch
the process environment:

```rust
let map = std::collections::HashMap::from([
	("CABINET_SESSION_REDIS_URL".to_string(), "redis://localhost:6379".to_string()),
	("CABINET_BANKING_ISSUANCE_TOKEN".to_string(), "test-token".to_string()),
]);
let settings = AppSettings::from_source(|var| map.get(var).cloned())?;
```

Assert on aggregate failures through the typed error, not string matching:

```rust
use ev_lib::settings::FieldErrorKind;
let error = AppSettings::from_source(|_| None).unwrap_err();
assert!(error.errors.iter().any(|e| e.var == "CABINET_SESSION_REDIS_URL" && e.kind == FieldErrorKind::Missing));
```

## Migrating from `v_utils` LiveSettings

This feature is the deliberate "shortening" of
[`v_utils_macros`](https://github.com/valeratrades/v_utils)' `Settings` /
`LiveSettings` down to what env-first services actually use. What was cut, and
where it went:

| `v_utils` | here |
| --- | --- |
| clap `SettingsFlags` (a flag per field) | gone — settings are env-only; keep your own clap for real CLI args |
| XDG config-file scan (7 formats), `nix eval` for `.nix` configs | gone — no file layer |
| `LiveSettings` mtime-polling hot reload | gone — env is fixed at `exec`; restart to reconfigure |
| interactive "extend the config file" stdin prompt | gone — the aggregate error lists everything instead |
| `write-defaults` / `diff` / `schema` subcommands | `var_names()` covers the `.env.example` case |
| nightly host crate (`specialization`, `default_field_values`) | stable-compatible `macro_rules!` |
| precedence flags > file > env | env is the only source |
| `#[settings(use_env = true)]` SHOUTY names | the default (and only) behaviour |

Migration recipe (e.g. `banking/cabinet/backend`): keep the struct, drop the
three derives for `ev_lib::settings!`, move any file-only values into env (via
the sops flow above), replace `LiveSettings::new(flags, freq)` + `.config()`
with one `AppSettings::from_env()` at startup.

## Gotchas

- **Call `from_env` once, at startup.** It re-reads the environment on every
  call by design (no caching, no statics) — a service should read once and pass
  the struct down.
- **`#[env]` ignores the prefix.** It is the *final* name — that's what makes
  shared names (`POSTHOG_KEY`) usable from a prefixed struct.
- **A bad default hides until the var is unset.** Defaults are parsed only when
  used (mirroring TS); keep a test that builds your settings from an empty
  source.
- **Secret lists:** item errors carry the item *position*, never the value —
  safe, but expect `item 2: …` instead of the offending token.
- **wasm:** `from_env` compiles on `wasm32-unknown-unknown` but sees an empty
  environment — browser config belongs to `@evinvest/settings`.
