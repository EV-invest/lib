//! `settings` — typed env settings (mirrors `@evinvest/settings`).
//!
//! The [`settings!`](crate::settings!) macro turns a struct-shaped declaration
//! into a settings type that reads **environment variables only** — no config
//! files, no CLI flags, no hot reload (a process's environment is fixed at
//! `exec`). Secrets management stays at the shell/CI boundary (sops + age —
//! see [`GUIDE.md`](./GUIDE.md)); this library never decrypts anything, it only
//! reads the already-injected environment.
//!
//! The contract, shared byte-for-byte with the TS mirror:
//!
//! - Var names are `SCREAMING_SNAKE` of the field name, with an optional
//!   struct-level `prefix` and a per-field `#[env("NAME")]` override (the
//!   override is the final name — the prefix does not apply to it).
//! - Fields are **required by default**; `Option<T>` opts out; `= "literal"`
//!   supplies a default that is parsed by the same rules as the env value.
//! - An **empty string is unset** — `VAR=` behaves exactly like no `VAR`.
//! - `bool` accepts `true`/`false`/`1`/`0` (ASCII case-insensitive); `Vec<T>`
//!   splits on `,`, trims items, and drops empty items; everything else parses
//!   via [`FromEnvValue`] (delegating to `FromStr` for std types).
//! - Errors **aggregate**: one [`SettingsError`] lists every missing/invalid
//!   variable at once, instead of failing on the first.
//! - `#[secret]` fields redact their value in `Debug` output and in error
//!   messages.
//! - `#[required_in("production", …)]` re-requires an `Option`/defaulted field
//!   in the named deployment profiles, matched against [`PROFILE_VAR`] read
//!   from the same source (unset ⇒ [`DEFAULT_PROFILE`]).
//!
//! Two things sit next to the macro: [`or_exit`] fails a boot with
//! [`EX_CONFIG`] instead of a nondescript 1, and [`drift`] reports when the
//! source a process was configured from has moved on without it.
//!
//! ```
//! ev_lib::settings! {
//!     /// Example service settings.
//!     pub struct Example {
//!         database_url: String,
//!         port: u16 = "8080",
//!         #[secret]
//!         api_token: String,
//!         posthog_key: Option<String>,
//!     }
//! }
//!
//! let map = std::collections::HashMap::from([
//!     ("DATABASE_URL".to_string(), "postgres://localhost/app".to_string()),
//!     ("API_TOKEN".to_string(), "shh".to_string()),
//! ]);
//! let example = Example::from_source(|var| map.get(var).cloned()).unwrap();
//! assert_eq!(example.port, 8080); // default applied
//! assert_eq!(example.posthog_key, None); // optional
//! assert!(!format!("{example:?}").contains("shh")); // secret redacted
//! ```
//!
//! In production use the generated `from_env()` (reads `std::env::var`).

mod value;
pub use value::FromEnvValue;

mod macros;

pub mod drift;
pub mod presets;

#[cfg(test)]
mod tests;

use std::fmt;

/// The variable that names the deployment profile `#[required_in(…)]` matches
/// against. Org-canonical (see [`presets::AppEnv`]), so a service never has to
/// re-declare which var decides "are we in production".
pub const PROFILE_VAR: &str = "APP_ENV";
/// The profile assumed when [`PROFILE_VAR`] is unset — the safe default, since
/// an unconfigured environment is a developer's laptop, not production.
pub const DEFAULT_PROFILE: &str = "development";
/// `EX_CONFIG` from `sysexits.h`: the process died because its configuration is
/// wrong, not because a dependency blipped. Restarting it unchanged cannot help
/// — which is exactly what an operator (and a CrashLoopBackOff triage) needs to
/// know.
pub const EX_CONFIG: i32 = 78;
/// Aggregate settings failure: every missing/invalid variable found in one
/// pass. `Display` lists each problem on its own line; secret fields never
/// print their value.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SettingsError {
	pub errors: Vec<FieldError>,
}

impl fmt::Display for SettingsError {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		let noun = if self.errors.len() == 1 { "problem" } else { "problems" };
		write!(f, "invalid settings ({} {noun})", self.errors.len())?;
		for error in &self.errors {
			write!(f, "\n  - {error}")?;
		}
		Ok(())
	}
}

impl std::error::Error for SettingsError {}

/// One problem with one variable.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FieldError {
	/// The env var name as it was looked up (prefix/override applied).
	pub var: String,
	pub kind: FieldErrorKind,
}

impl fmt::Display for FieldError {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		match &self.kind {
			FieldErrorKind::Missing => write!(f, "{}: missing", self.var),
			FieldErrorKind::MissingInProfile { profile } => write!(f, "{}: missing (required when {PROFILE_VAR}={profile})", self.var),
			FieldErrorKind::Invalid { value: Some(value), message } => write!(f, "{}: invalid value {value:?}: {message}", self.var),
			FieldErrorKind::Invalid { value: None, message } => write!(f, "{}: invalid value: {message}", self.var),
		}
	}
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FieldErrorKind {
	/// Required variable is unset (or set to the empty string).
	Missing,
	/// A `#[required_in(…)]` variable that is unset while the active profile is
	/// one it names — the "optional in dev, mandatory in prod" case.
	MissingInProfile { profile: String },
	/// The value failed to parse. `value` is `None` for `#[secret]` fields.
	Invalid { value: Option<String>, message: String },
}

/// Read the active deployment profile from a source, honouring the same
/// empty-is-unset rule as every other variable.
pub fn profile(source: &mut impl FnMut(&str) -> Option<String>) -> String {
	lookup(source, PROFILE_VAR).unwrap_or_else(|| DEFAULT_PROFILE.to_string())
}

/// Unwrap a settings load, or print every problem and exit [`EX_CONFIG`].
///
/// Use this instead of `?` at a service's entry point: propagating the error
/// gives exit code 1, indistinguishable from "the database was briefly gone",
/// and buries the aggregate list under a backtrace.
///
/// ```no_run
/// # ev_lib::settings! { pub struct AppSettings { database_url: String } }
/// let settings = ev_lib::settings::or_exit(AppSettings::from_env());
/// ```
#[cfg(not(target_arch = "wasm32"))]
pub fn or_exit<T>(loaded: Result<T, SettingsError>) -> T {
	match loaded {
		Ok(settings) => settings,
		Err(error) => {
			eprintln!("{error}");
			std::process::exit(EX_CONFIG);
		}
	}
}

/// The final env var name for a field: the `#[env("NAME")]` override verbatim,
/// else `PREFIX_` + the SCREAMING_SNAKE field name (or just the SCREAMING_SNAKE
/// field name without a prefix). A raw identifier (`r#type`) derives from its
/// bare name (`TYPE`) — `#` can't appear in an env var name.
pub fn env_name(prefix: Option<&str>, explicit: Option<&str>, field: &str) -> String {
	match explicit {
		Some(name) => name.to_string(),
		None => {
			let shouty = field.strip_prefix("r#").unwrap_or(field).to_ascii_uppercase();
			match prefix {
				Some(prefix) => format!("{prefix}_{shouty}"),
				None => shouty,
			}
		}
	}
}

/// Read one variable from a source, normalising the empty string to unset.
pub fn lookup(source: &mut impl FnMut(&str) -> Option<String>, var: &str) -> Option<String> {
	source(var).filter(|value| !value.is_empty())
}

/// Parse a required field. Pushes [`FieldErrorKind::Missing`] /
/// [`FieldErrorKind::Invalid`] and returns `None` on failure.
pub fn require<T: FromEnvValue>(raw: Option<String>, var: &str, secret: bool, errors: &mut Vec<FieldError>) -> Option<T> {
	match raw {
		None => {
			errors.push(FieldError {
				var: var.to_string(),
				kind: FieldErrorKind::Missing,
			});
			None
		}
		Some(raw) => parse_value(&raw, var, secret, errors),
	}
}

/// Parse an `Option<T>` field: unset is `Some(None)` (fine), a present value
/// must still parse. The outer `None` means an error was recorded.
pub fn optional<T: FromEnvValue>(raw: Option<String>, var: &str, secret: bool, errors: &mut Vec<FieldError>) -> Option<Option<T>> {
	match raw {
		None => Some(None),
		Some(raw) => parse_value(&raw, var, secret, errors).map(Some),
	}
}

/// Parse an `Option<T>` field carrying `#[required_in(…)]`: identical to
/// [`optional`], except that being unset is an error when `profile` is one of
/// `required_in`.
pub fn optional_required_in<T: FromEnvValue>(raw: Option<String>, var: &str, secret: bool, errors: &mut Vec<FieldError>, profile: &str, required_in: &[&str]) -> Option<Option<T>> {
	match raw {
		None if required_in.contains(&profile) => {
			errors.push(FieldError {
				var: var.to_string(),
				kind: FieldErrorKind::MissingInProfile { profile: profile.to_string() },
			});
			None
		}
		None => Some(None),
		Some(raw) => parse_value(&raw, var, secret, errors).map(Some),
	}
}

/// Parse a defaulted field carrying `#[required_in(…)]`: identical to
/// [`with_default`], except that in a named profile the default does not apply
/// — the variable must be set explicitly. For values whose dev-friendly default
/// is wrong in production (a loopback bind, a permissive origin) this turns a
/// silent misconfiguration into a boot failure.
pub fn with_default_required_in<T: FromEnvValue>(
	raw: Option<String>,
	default: &str,
	var: &str,
	secret: bool,
	errors: &mut Vec<FieldError>,
	profile: &str,
	required_in: &[&str],
) -> Option<T> {
	match raw {
		None if required_in.contains(&profile) => {
			errors.push(FieldError {
				var: var.to_string(),
				kind: FieldErrorKind::MissingInProfile { profile: profile.to_string() },
			});
			None
		}
		raw => with_default(raw, default, var, secret, errors),
	}
}

/// Parse a defaulted field: the default literal goes through the exact same
/// parsing rules as an env value, but only when the variable is unset.
pub fn with_default<T: FromEnvValue>(raw: Option<String>, default: &str, var: &str, secret: bool, errors: &mut Vec<FieldError>) -> Option<T> {
	match raw {
		Some(raw) => parse_value(&raw, var, secret, errors),
		None => match T::from_env_value(default) {
			Ok(value) => Some(value),
			Err(message) => {
				errors.push(FieldError {
					var: var.to_string(),
					kind: FieldErrorKind::Invalid {
						value: Some(default.to_string()),
						message: format!("invalid default: {message}"),
					},
				});
				None
			}
		},
	}
}

fn parse_value<T: FromEnvValue>(raw: &str, var: &str, secret: bool, errors: &mut Vec<FieldError>) -> Option<T> {
	match T::from_env_value(raw) {
		Ok(value) => Some(value),
		Err(message) => {
			errors.push(FieldError {
				var: var.to_string(),
				kind: FieldErrorKind::Invalid {
					value: (!secret).then(|| raw.to_string()),
					message,
				},
			});
			None
		}
	}
}
