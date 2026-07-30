//! Behaviour tests for the `settings!` macro and the parsing contract.
//!
//! The `contract` module is the shared Rust↔TS vector table — it is mirrored
//! in `ts/settings/test/contract.node.test.ts`. Change the vectors on BOTH
//! sides or not at all.

use std::collections::HashMap;

use super::{FieldError, FieldErrorKind, FromEnvValue};

fn map_source(pairs: &[(&str, &str)]) -> impl FnMut(&str) -> Option<String> {
	let map: HashMap<String, String> = pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
	move |var| map.get(var).cloned()
}

crate::settings! {
	/// Every field shape in one struct.
	pub struct Full, prefix = "APP" {
		/// `APP_DATABASE_URL`
		database_url: String,
		/// `APP_PORT`
		port: u16 = "8080",
		/// `APP_DEBUG`
		debug: bool = "false",
		/// `APP_ADMIN_SUBJECTS`
		admin_subjects: Vec<String> = "",
		/// `POSTHOG_KEY` — full-name override, prefix not applied.
		#[env("POSTHOG_KEY")]
		posthog_key: Option<String>,
		/// `APP_SIGNING_KEY`
		#[secret]
		signing_key: String,
	}
}

crate::settings! {
	struct Unprefixed {
		bind: std::net::SocketAddr,
		timeout_secs: Option<u64>,
	}
}

#[test]
fn happy_path_every_field_shape() {
	let full = Full::from_source(map_source(&[
		("APP_DATABASE_URL", "postgres://localhost/app"),
		("APP_DEBUG", "1"),
		("APP_ADMIN_SUBJECTS", "alice, bob ,,carol"),
		("POSTHOG_KEY", "phc_123"),
		("APP_SIGNING_KEY", "hunter2"),
	]))
	.unwrap();

	assert_eq!(full.database_url, "postgres://localhost/app");
	assert_eq!(full.port, 8080); // default applied
	assert!(full.debug);
	assert_eq!(full.admin_subjects, vec!["alice", "bob", "carol"]);
	assert_eq!(full.posthog_key.as_deref(), Some("phc_123"));
	assert_eq!(full.signing_key, "hunter2");
}

#[test]
fn unprefixed_names_are_shouty_field_names() {
	let unprefixed = Unprefixed::from_source(map_source(&[("BIND", "127.0.0.1:8080")])).unwrap();
	assert_eq!(unprefixed.bind, "127.0.0.1:8080".parse().unwrap());
	assert_eq!(unprefixed.timeout_secs, None);
	assert_eq!(Unprefixed::var_names(), vec!["BIND", "TIMEOUT_SECS"]);
}

crate::settings! {
	/// The "optional in dev, mandatory in prod" surface.
	struct Profiled {
		/// Unset is fine locally; in production a silent no-op mailer is not.
		#[required_in("production")]
		smtp_host: Option<String>,
		/// A dev-friendly default that must not survive into production.
		#[required_in("production", "staging")]
		public_origin: String = "http://localhost:3000",
		/// No profile marker: optional everywhere.
		posthog_key: Option<String>,
	}
}

#[test]
fn required_in_is_inert_outside_the_named_profiles() {
	// APP_ENV unset ⇒ `development`.
	let profiled = Profiled::from_source(map_source(&[])).unwrap();
	assert_eq!(profiled.smtp_host, None);
	assert_eq!(profiled.public_origin, "http://localhost:3000");

	// A profile nobody named behaves the same way.
	let profiled = Profiled::from_source(map_source(&[("APP_ENV", "preview")])).unwrap();
	assert_eq!(profiled.smtp_host, None);
}

#[test]
fn required_in_fails_the_load_in_a_named_profile() {
	let error = Profiled::from_source(map_source(&[("APP_ENV", "production")])).unwrap_err();

	let vars: Vec<&str> = error.errors.iter().map(|e| e.var.as_str()).collect();
	assert_eq!(vars, vec!["SMTP_HOST", "PUBLIC_ORIGIN"], "the defaulted field's default must not apply either");
	assert_eq!(error.errors[0].kind, FieldErrorKind::MissingInProfile { profile: "production".to_string() });
	assert!(error.to_string().contains("SMTP_HOST: missing (required when APP_ENV=production)"));

	// A second named profile is honoured — and `staging` does not name SMTP_HOST,
	// so satisfying PUBLIC_ORIGIN alone is enough there.
	let profiled = Profiled::from_source(map_source(&[("APP_ENV", "staging"), ("PUBLIC_ORIGIN", "https://evinvest.ltd")])).unwrap();
	assert_eq!(profiled.smtp_host, None);
}

#[test]
fn required_in_still_parses_a_value_that_is_present() {
	let profiled = Profiled::from_source(map_source(&[
		("APP_ENV", "production"),
		("SMTP_HOST", "smtp.gmail.com"),
		("PUBLIC_ORIGIN", "https://evinvest.ltd"),
	]))
	.unwrap();
	assert_eq!(profiled.smtp_host.as_deref(), Some("smtp.gmail.com"));
	assert_eq!(profiled.public_origin, "https://evinvest.ltd");
	assert_eq!(profiled.posthog_key, None);
}

#[test]
fn required_var_names_is_the_deploy_checklist() {
	assert_eq!(Profiled::required_var_names("development"), Vec::<String>::new());
	assert_eq!(Profiled::required_var_names("staging"), vec!["PUBLIC_ORIGIN"]);
	assert_eq!(Profiled::required_var_names("production"), vec!["SMTP_HOST", "PUBLIC_ORIGIN"]);
	// Plain required fields are on the list in every profile; optional ones never.
	assert_eq!(Full::required_var_names("production"), vec!["APP_DATABASE_URL", "APP_SIGNING_KEY"]);
	// `var_names()` stays the full surface — the checklist is a subset of it.
	for var in Profiled::required_var_names("production") {
		assert!(Profiled::var_names().contains(&var));
	}
}

#[test]
fn errors_aggregate_in_declaration_order() {
	let error = Full::from_source(map_source(&[("APP_PORT", "not-a-port"), ("APP_SIGNING_KEY", "k")])).unwrap_err();

	let vars: Vec<&str> = error.errors.iter().map(|e| e.var.as_str()).collect();
	assert_eq!(vars, vec!["APP_DATABASE_URL", "APP_PORT"]);
	assert_eq!(error.errors[0].kind, FieldErrorKind::Missing);
	assert!(matches!(&error.errors[1].kind, FieldErrorKind::Invalid { value: Some(v), .. } if v == "not-a-port"));

	let display = error.to_string();
	assert!(display.starts_with("invalid settings (2 problems)"));
	assert!(display.contains("\n  - APP_DATABASE_URL: missing"));
	assert!(display.contains("\n  - APP_PORT: invalid value \"not-a-port\": "));
}

#[test]
fn one_problem_is_singular() {
	let error = Unprefixed::from_source(|_| None).unwrap_err();
	assert!(error.to_string().starts_with("invalid settings (1 problem)"));
}

#[test]
fn empty_string_is_unset_for_every_field_kind() {
	// Required -> missing; defaulted -> default; optional -> None.
	let error = Full::from_source(map_source(&[("APP_DATABASE_URL", ""), ("APP_SIGNING_KEY", "k")])).unwrap_err();
	assert_eq!(
		error.errors,
		vec![FieldError {
			var: "APP_DATABASE_URL".to_string(),
			kind: FieldErrorKind::Missing
		}]
	);

	let full = Full::from_source(map_source(&[("APP_DATABASE_URL", "db"), ("APP_PORT", ""), ("POSTHOG_KEY", ""), ("APP_SIGNING_KEY", "k")])).unwrap();
	assert_eq!(full.port, 8080);
	assert_eq!(full.posthog_key, None);
}

#[test]
fn secret_fields_redact_debug_and_errors() {
	let full = Full::from_source(map_source(&[("APP_DATABASE_URL", "db"), ("APP_SIGNING_KEY", "hunter2")])).unwrap();
	let debug = format!("{full:?}");
	assert!(debug.contains("signing_key: \"***\""));
	assert!(!debug.contains("hunter2"));
	assert!(debug.contains("database_url: \"db\"")); // non-secrets stay visible

	crate::settings! {
		struct SecretNumber {
			#[secret]
			attempts: u32,
		}
	}
	let error = SecretNumber::from_source(map_source(&[("ATTEMPTS", "s3cr3t")])).unwrap_err();
	assert!(matches!(&error.errors[0].kind, FieldErrorKind::Invalid { value: None, .. }));
	assert!(!error.to_string().contains("s3cr3t"));
	assert!(error.to_string().contains("ATTEMPTS: invalid value: "));
	assert_eq!(SecretNumber::from_source(map_source(&[("ATTEMPTS", "3")])).unwrap().attempts, 3);
}

#[test]
fn optional_secret_debug_shows_presence_not_value() {
	crate::settings! {
		struct OptSecret {
			#[secret]
			token: Option<String>,
		}
	}
	let unset = OptSecret::from_source(|_| None).unwrap();
	assert!(format!("{unset:?}").contains("token: None"));

	let set = OptSecret::from_source(map_source(&[("TOKEN", "hunter2")])).unwrap();
	let debug = format!("{set:?}");
	assert!(debug.contains("token: Some(\"***\")"));
	assert!(!debug.contains("hunter2"));
}

#[test]
fn invalid_default_is_reported_when_used() {
	crate::settings! {
		struct BadDefault {
			port: u16 = "not-a-port",
		}
	}
	// Env value present: the default is never parsed.
	assert!(BadDefault::from_source(map_source(&[("PORT", "80")])).is_ok());
	// Unset: the bad default surfaces as `invalid default: …`.
	let error = BadDefault::from_source(|_| None).unwrap_err();
	assert!(matches!(&error.errors[0].kind, FieldErrorKind::Invalid { message, .. } if message.starts_with("invalid default: ")));
}

#[test]
fn var_names_reflect_prefix_and_overrides() {
	assert_eq!(
		Full::var_names(),
		vec!["APP_DATABASE_URL", "APP_PORT", "APP_DEBUG", "APP_ADMIN_SUBJECTS", "POSTHOG_KEY", "APP_SIGNING_KEY"]
	);
}

#[test]
fn from_env_reads_the_process_environment() {
	// `from_env` is a one-line delegation to `from_source` over `std::env::var`;
	// only the fallback path is asserted — mutating the process environment
	// (`env::set_var`) is unsound with the parallel test harness.
	crate::settings! {
		struct ProcessEnv {
			ev_lib_settings_test_only: String = "fallback",
		}
	}
	assert_eq!(ProcessEnv::from_env().unwrap().ev_lib_settings_test_only, "fallback");
}

#[test]
fn raw_identifier_fields_derive_the_bare_name() {
	crate::settings! {
		struct RawIdent {
			r#type: Option<String>,
		}
	}
	assert_eq!(RawIdent::var_names(), vec!["TYPE"]);
	let raw_ident = RawIdent::from_source(map_source(&[("TYPE", "postgres")])).unwrap();
	assert_eq!(raw_ident.r#type.as_deref(), Some("postgres"));
}

#[test]
fn presets_load_with_canonical_names() {
	use super::presets::{AppEnv, Posthog, Sentry};

	assert_eq!(Posthog::var_names(), vec!["POSTHOG_KEY", "POSTHOG_HOST"]);
	assert_eq!(Sentry::var_names(), vec!["SENTRY_DSN"]);
	assert_eq!(AppEnv::var_names(), vec!["APP_ENV"]);

	let posthog = Posthog::from_source(map_source(&[("POSTHOG_KEY", "phc_1")])).unwrap();
	assert_eq!(posthog.key.as_deref(), Some("phc_1"));
	assert_eq!(posthog.host, None);

	assert_eq!(AppEnv::from_source(|_| None).unwrap().app_env, "development");
	assert_eq!(AppEnv::from_source(map_source(&[("APP_ENV", "production")])).unwrap().app_env, "production");
}

/// Shared Rust↔TS parsing-contract vectors — mirrored byte-for-byte in
/// `ts/settings/test/contract.node.test.ts`. Change both sides or neither.
mod contract {
	use super::*;

	#[test]
	fn bool_vectors() {
		for raw in ["true", "TRUE", "True", "1"] {
			assert_eq!(bool::from_env_value(raw), Ok(true), "raw={raw:?}");
		}
		for raw in ["false", "FALSE", "False", "0"] {
			assert_eq!(bool::from_env_value(raw), Ok(false), "raw={raw:?}");
		}
		for raw in ["yes", "no", "2", " true", "true ", ""] {
			assert!(bool::from_env_value(raw).is_err(), "raw={raw:?} must be invalid");
		}
	}

	#[test]
	fn list_vectors() {
		assert_eq!(Vec::<String>::from_env_value("a, b ,c"), Ok(vec!["a".to_string(), "b".to_string(), "c".to_string()]));
		assert_eq!(Vec::<String>::from_env_value("a,,b"), Ok(vec!["a".to_string(), "b".to_string()]));
		assert_eq!(Vec::<String>::from_env_value(",,"), Ok(vec![]));
		assert_eq!(Vec::<u16>::from_env_value("1, 2,3"), Ok(vec![1, 2, 3]));
		// U+FEFF (BOM) trims like whitespace — JS `trim()` semantics.
		assert_eq!(Vec::<String>::from_env_value("a,\u{feff}b"), Ok(vec!["a".to_string(), "b".to_string()]));
		// Item numbering counts kept items and never leaks the item value.
		let error = Vec::<u16>::from_env_value(",zzz9,2").unwrap_err();
		assert!(error.starts_with("item 1: "), "got {error:?}");
		assert!(!error.contains("zzz9"), "item value must not leak: {error:?}");
	}

	#[test]
	fn scalars_are_not_trimmed() {
		assert!(u16::from_env_value(" 8080").is_err());
		assert!(u16::from_env_value("8080 ").is_err());
		assert_eq!(u16::from_env_value("8080"), Ok(8080));
		assert_eq!(String::from_env_value(" keep me "), Ok(" keep me ".to_string()));
	}

	#[test]
	fn number_vectors() {
		// Integers: plain decimal only, optional sign.
		assert_eq!(u16::from_env_value("8080"), Ok(8080));
		assert_eq!(i64::from_env_value("+5"), Ok(5));
		for raw in ["1e3", "0x10", "0b101", "0o17", "5.", "5.0"] {
			assert!(u16::from_env_value(raw).is_err(), "raw={raw:?} must be invalid for an integer");
		}
		// Floats: decimal, point, and exponent forms.
		assert_eq!(f64::from_env_value("1e3"), Ok(1000.0));
		assert_eq!(f64::from_env_value("5."), Ok(5.0));
		assert_eq!(f64::from_env_value(".5"), Ok(0.5));
		assert!(f64::from_env_value("0x10").is_err());
		// Documented divergences (deliberately NOT mirrored): Rust `f64` also
		// accepts `inf`/`NaN` where TS `num()` requires finite; Rust 64-bit
		// integers parse exactly where TS `int()` stops at the safe range.
	}
}
