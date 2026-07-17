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

pub mod presets;

#[cfg(test)]
mod tests;

use std::fmt;

/// Aggregate settings failure: every missing/invalid variable found in one
/// pass. `Display` lists each problem on its own line; secret fields never
/// print their value.
#[derive(Clone, Debug, PartialEq, Eq)]
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
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FieldError {
	/// The env var name as it was looked up (prefix/override applied).
	pub var: String,
	pub kind: FieldErrorKind,
}

impl fmt::Display for FieldError {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		match &self.kind {
			FieldErrorKind::Missing => write!(f, "{}: missing", self.var),
			FieldErrorKind::Invalid { value: Some(value), message } => write!(f, "{}: invalid value {value:?}: {message}", self.var),
			FieldErrorKind::Invalid { value: None, message } => write!(f, "{}: invalid value: {message}", self.var),
		}
	}
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum FieldErrorKind {
	/// Required variable is unset (or set to the empty string).
	Missing,
	/// The value failed to parse. `value` is `None` for `#[secret]` fields.
	Invalid { value: Option<String>, message: String },
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
