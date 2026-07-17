# `ev_lib::settings`

Typed env settings — the Rust mirror of
[`@evinvest/settings`](../../../ts/settings). The `settings!` macro turns a
struct-shaped declaration into a settings type that reads **environment
variables only**, validates everything in one pass, and reports every
missing/invalid variable in a single aggregate error.

> This is an **opt-in**, **zero-dep** library, not the `architecture` kernel:
> it touches host state (the process environment) — but no files and no
> network. There is deliberately **no config-file layer and no hot reload**: a
> process's environment is fixed at `exec`, and secrets management stays at the
> shell/CI boundary (sops + age) — this library never decrypts anything. See
> the [GUIDE](./GUIDE.md) for the full sops workflow.

## Install

```toml
[dependencies]
ev_lib = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["settings"] }
```

`wasm32`-safe by construction (no browser env exists, so `from_env` simply
reports every required var as missing there — browser settings are the TS
package's job).

## Usage

```rust
ev_lib::settings! {
	/// One `settings.rs` per service; `prefix` is optional.
	pub struct AppSettings, prefix = "CABINET" {
		/// `CABINET_BIND`
		bind: std::net::SocketAddr = "127.0.0.1:8080",
		/// `CABINET_SESSION_REDIS_URL` — required.
		session_redis_url: String,
		/// `CABINET_BANKING_ISSUANCE_TOKEN` — redacted in `Debug` + errors.
		#[secret]
		banking_issuance_token: String,
		/// `CABINET_MFE_ALLOWED_ORIGINS` — comma-separated.
		mfe_allowed_origins: Vec<String> = "",
		/// `POSTHOG_KEY` — `#[env]` overrides the full name (no prefix).
		#[env("POSTHOG_KEY")]
		posthog_key: Option<String>,
	}
}

fn main() -> Result<(), ev_lib::settings::SettingsError> {
	let settings = AppSettings::from_env()?; // one error listing EVERY problem
	println!("{settings:?}");                // secrets print as "***"
	Ok(())
}
```

Generated API: the struct (fields `pub`, `Clone`, redacting `Debug`),
`from_env()`, `from_source(impl FnMut(&str) -> Option<String>)` (tests, custom
stores), and `var_names()` (declaration-order var list — generate a
`.env.example` from it).

Types parse themselves through [`FromEnvValue`](./value.rs) — implemented for
`String`, `bool`, the numeric primitives, `PathBuf`, the `std::net` address
types, and `Vec<T>`; add your own `FromStr` types with
`ev_lib::settings_via_from_str!`.

Shared canonical names (`POSTHOG_KEY`, `SENTRY_DSN`, `APP_ENV`) ship as
ready-made structs in [`presets`](./presets.rs).

## Rust ↔ TS parity

The Rust crate is the source of truth; the TS package preserves its
*semantics*.

| Concept | Rust (`ev_lib::settings`) | TS (`@evinvest/settings`) |
| --- | --- | --- |
| declaration | `settings! { pub struct S { … } }` | `createSettings({ server, client, … })` |
| var naming | SHOUTY field name, `prefix =`, `#[env("NAME")]` | keys are the var names (written out) |
| required | plain field | plain validator |
| optional | `Option<T>` | `optional(v)` |
| default | `= "literal"` (parsed by the same rules) | `withDefault(v, "literal")` |
| secret | `#[secret]` (Debug + errors) | `secret(v)` (errors; JS has no Debug boundary) |
| typing | `FromEnvValue` (types parse themselves) | named validators (`str`, `num`, `port`, …) |
| aggregate errors | `SettingsError { errors }` | `SettingsError.issues` (same message shape) |
| injected source | `from_source(fn)` | `runtimeEnv` record |
| shared names | `presets::{Posthog, Sentry, AppEnv}` | `presets.posthog()` … + `NEXT_PUBLIC_*` client variants |
| client/server split | — (no browser bundle) | `server` / `client` + `clientPrefix` |

The parsing contract (bool/list rules, empty-string-is-unset, no trimming) is
pinned by mirrored test vectors: `rust/src/settings/tests.rs` (`mod contract`)
↔ `ts/settings/test/contract.node.test.ts`. Change both sides or neither.

## Limitations

- **Env-only, flat.** No config files, no CLI flags, no `__`-nested sections —
  a service that needs layered file config should reach for a config crate, not
  this. (This is the deliberate "shortening" of `v_utils`' `LiveSettings` —
  see the [GUIDE](./GUIDE.md#migrating-from-v_utils-livesettings).)
- **No hot reload.** `from_env` is a one-shot read; env can't change under a
  running process anyway.
- **`Option` must be written literally** (`Option<T>`, not
  `std::option::Option<T>`) — the macro matches it by name. An `Option` field
  cannot take a default (compile error).
- **One attr set.** Only doc comments, `#[secret]`, and `#[env("NAME")]` are
  understood on fields; anything else is a macro error.

## Develop

Verified from the repo root:

```sh
cargo test   -p ev_lib --features settings
cargo clippy -p ev_lib --features settings --all-targets -- -D warnings
cargo check  -p ev_lib --features "settings wasm" --target wasm32-unknown-unknown
```

See [`GUIDE.md`](./GUIDE.md) for the cookbook, the sops/age secrets workflow,
and migration notes.
