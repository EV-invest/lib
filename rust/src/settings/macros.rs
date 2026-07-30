//! The [`settings!`](crate::settings!) macro — declaration syntax and code
//! generation. Runtime semantics (lookup, parsing, error aggregation) live in
//! the [`settings`](crate::settings) module; the macro only wires fields to
//! those helpers, so the behaviour stays greppable outside macro expansions.

/// Declare a typed env settings struct.
///
/// ```
/// ev_lib::settings! {
///     /// My service settings. `prefix` is optional; with it every derived
///     /// var name becomes `PREFIX_FIELD_NAME`.
///     pub struct AppSettings, prefix = "APP" {
///         /// `APP_DATABASE_URL` — required.
///         database_url: String,
///         /// `APP_PORT` — defaulted; the literal parses by the same rules.
///         port: u16 = "8080",
///         /// `APP_ADMIN_SUBJECTS` — comma-separated list.
///         admin_subjects: Vec<String> = "",
///         /// `POSTHOG_KEY` — `#[env]` overrides the full name (no prefix).
///         #[env("POSTHOG_KEY")]
///         posthog_key: Option<String>,
///         /// `APP_SIGNING_KEY` — redacted in `Debug` and in error output.
///         #[secret]
///         signing_key: String,
///         /// `APP_SMTP_HOST` — unset is fine locally, a boot failure in prod.
///         #[required_in("production")]
///         smtp_host: Option<String>,
///     }
/// }
///
/// let map = std::collections::HashMap::from([
///     ("APP_DATABASE_URL".to_string(), "postgres://localhost/app".to_string()),
///     ("APP_SIGNING_KEY".to_string(), "shh".to_string()),
/// ]);
/// let settings = AppSettings::from_source(|var| map.get(var).cloned()).unwrap();
/// assert_eq!(settings.port, 8080);
/// assert_eq!(settings.admin_subjects, Vec::<String>::new());
/// assert_eq!(settings.smtp_host, None); // APP_ENV is unset ⇒ `development`
/// ```
///
/// Generated API: the struct itself (fields `pub`, `Clone`, redacting `Debug`),
/// `from_env()`, `from_source(impl FnMut(&str) -> Option<String>)`,
/// `var_names()` (every var the struct reads, in declaration order — handy for
/// generating a `.env.example`), and `required_var_names(profile)` (the subset
/// that must be set in that deployment profile — the deploy-time checklist).
///
/// Field grammar: `#[secret]`, `#[env("NAME")]`, and/or
/// `#[required_in("profile", …)]` (plus doc comments), then `name: Type`,
/// `name: Type = "default"`, or `name: Option<Type>`. Write `Option` literally —
/// the macro matches it by name. An `Option` field cannot take a default (a
/// defaulted field is always present).
///
/// `#[required_in(…)]` names deployment profiles, compared against
/// [`APP_ENV`](crate::settings::PROFILE_VAR) read from the same source
/// (unset ⇒ `development`). On an `Option<T>` field it makes unset an error in
/// those profiles; on a defaulted field it makes the default not apply there, so
/// the value must be explicit. It is a compile error on an already-required
/// field.
#[macro_export]
macro_rules! settings {
	(
		$(#[$meta:meta])*
		$vis:vis struct $name:ident, prefix = $prefix:literal { $($fields:tt)* }
	) => {
		$crate::settings! { @parse [$(#[$meta])*] ($vis) $name (::core::option::Option::Some($prefix)) [] $($fields)* }
	};
	(
		$(#[$meta:meta])*
		$vis:vis struct $name:ident { $($fields:tt)* }
	) => {
		$crate::settings! { @parse [$(#[$meta])*] ($vis) $name (::core::option::Option::None) [] $($fields)* }
	};

	// ---- field munching: normalise every field into an accumulator record
	// `{ [docs] name (kind) (type) secret (env override) [required_in profiles] (default?) }` ----

	(@parse $meta:tt $vis:tt $name:ident $prefix:tt $acc:tt) => {
		$crate::settings! { @emit $meta $vis $name $prefix $acc }
	};
	(@parse $meta:tt $vis:tt $name:ident $prefix:tt $acc:tt $($rest:tt)+) => {
		$crate::settings! { @attrs $meta $vis $name $prefix $acc [] false (::core::option::Option::None) [] $($rest)+ }
	};

	// strip field attributes (doc comments, #[secret], #[env("NAME")], #[required_in(…)]) in any order
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt $acc:tt [$($docs:tt)*] $secret:tt $env:tt $req:tt #[doc $($doc:tt)+] $($rest:tt)+) => {
		$crate::settings! { @attrs $meta $vis $name $prefix $acc [$($docs)* #[doc $($doc)+]] $secret $env $req $($rest)+ }
	};
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt $acc:tt $docs:tt $secret:tt $env:tt $req:tt #[secret] $($rest:tt)+) => {
		$crate::settings! { @attrs $meta $vis $name $prefix $acc $docs true $env $req $($rest)+ }
	};
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt $acc:tt $docs:tt $secret:tt $env:tt $req:tt #[env($var:literal)] $($rest:tt)+) => {
		$crate::settings! { @attrs $meta $vis $name $prefix $acc $docs $secret (::core::option::Option::Some($var)) $req $($rest)+ }
	};
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt $acc:tt $docs:tt $secret:tt $env:tt $req:tt #[required_in($($profile:literal),+ $(,)?)] $($rest:tt)+) => {
		$crate::settings! { @attrs $meta $vis $name $prefix $acc $docs $secret $env [$($profile),+] $($rest)+ }
	};

	// field shapes; `Option` arms first so the general `$ty:ty` arms don't swallow them
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt $acc:tt $docs:tt $secret:tt $env:tt $req:tt $field:ident: Option<$ty:ty> = $default:literal $($rest:tt)*) => {
		::core::compile_error!("an `Option` settings field cannot take a default: drop the `Option` (a defaulted field is always present) or drop the default");
	};
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt [$($acc:tt)*] $docs:tt $secret:tt $env:tt $req:tt $field:ident: Option<$ty:ty> $(, $($rest:tt)*)?) => {
		$crate::settings! { @parse $meta $vis $name $prefix [$($acc)* { $docs $field (optional) ($ty) $secret $env $req () }] $($($rest)*)? }
	};
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt [$($acc:tt)*] $docs:tt $secret:tt $env:tt $req:tt $field:ident: $ty:ty = $default:literal $(, $($rest:tt)*)?) => {
		$crate::settings! { @parse $meta $vis $name $prefix [$($acc)* { $docs $field (defaulted) ($ty) $secret $env $req ($default) }] $($($rest)*)? }
	};
	// A plain required field is required everywhere; narrowing it to one profile
	// can only mean the author wanted `Option<T>` (or a default) as well.
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt $acc:tt $docs:tt $secret:tt $env:tt [$($profile:literal),+] $field:ident: $ty:ty $(, $($rest:tt)*)?) => {
		::core::compile_error!("`#[required_in(…)]` on an already-required field does nothing: make it `Option<T>` (unset is fine elsewhere) or give it a default");
	};
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt [$($acc:tt)*] $docs:tt $secret:tt $env:tt $req:tt $field:ident: $ty:ty $(, $($rest:tt)*)?) => {
		$crate::settings! { @parse $meta $vis $name $prefix [$($acc)* { $docs $field (required) ($ty) $secret $env $req () }] $($($rest)*)? }
	};

	// ---- emission ----

	(@emit [$(#[$meta:meta])*] ($vis:vis) $name:ident ($prefix:expr) [$({ [$($docs:tt)*] $field:ident ($kind:ident) ($ty:ty) $secret:tt ($env:expr) [$($req:literal),*] ($($default:literal)?) })*]) => {
		$(#[$meta])*
		#[derive(Clone)]
		$vis struct $name {
			$( $($docs)* pub $field: $crate::settings!(@ty $kind ($ty)), )*
		}

		// The generated fns are an opt-in surface: a struct consumed only through
		// `from_source` must not warn about the unused `from_env`/`var_names`.
		#[allow(dead_code)]
		impl $name {
			/// Build from the process environment (`std::env::var`), reporting
			/// every missing/invalid variable in one aggregate error.
			pub fn from_env() -> ::core::result::Result<Self, $crate::settings::SettingsError> {
				Self::from_source(|var| ::std::env::var(var).ok())
			}

			/// Build from an injected source — a test map, a custom store.
			/// The empty string counts as unset, exactly like `from_env`.
			pub fn from_source(mut source: impl ::core::ops::FnMut(&str) -> ::core::option::Option<::std::string::String>) -> ::core::result::Result<Self, $crate::settings::SettingsError> {
				#[allow(unused_mut)]
				let mut errors: ::std::vec::Vec<$crate::settings::FieldError> = ::std::vec::Vec::new();
				// Read from the same source as the fields, so a test map decides
				// the profile too. Unused when no field is `#[required_in(…)]`.
				#[allow(unused_variables)]
				let profile = $crate::settings::profile(&mut source);
				$(
					let $field = {
						let var = $crate::settings::env_name($prefix, $env, ::core::stringify!($field));
						let raw = $crate::settings::lookup(&mut source, &var);
						$crate::settings!(@get $kind ($ty), raw, var, $secret, errors, profile, [$($req),*] $(, $default)?)
					};
				)*
				if !errors.is_empty() {
					return ::core::result::Result::Err($crate::settings::SettingsError { errors });
				}
				::core::result::Result::Ok(Self {
					$( $field: $field.expect("field parsed: no error was recorded for it"), )*
				})
			}

			/// Every env var this struct reads, in declaration order.
			pub fn var_names() -> ::std::vec::Vec<::std::string::String> {
				::std::vec![ $( $crate::settings::env_name($prefix, $env, ::core::stringify!($field)), )* ]
			}

			/// The vars that MUST be set for `from_env` to succeed in `profile`:
			/// every plain required field, plus each `#[required_in(…)]` field
			/// that names it. This is the deploy-time checklist — a preflight can
			/// compare it against a Secret's keys before anything rolls out,
			/// instead of discovering the gap as a CrashLoopBackOff.
			#[allow(unused_variables)] // a struct with no `#[required_in]` field ignores the profile
			pub fn required_var_names(profile: &str) -> ::std::vec::Vec<::std::string::String> {
				#[allow(unused_mut)]
				let mut vars: ::std::vec::Vec<::std::string::String> = ::std::vec::Vec::new();
				$(
					if $crate::settings!(@required_here $kind [$($req),*], profile) {
						vars.push($crate::settings::env_name($prefix, $env, ::core::stringify!($field)));
					}
				)*
				vars
			}
		}

		impl ::core::fmt::Debug for $name {
			fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
				f.debug_struct(::core::stringify!($name))
					$( .field(::core::stringify!($field), $crate::settings!(@dbg $secret $kind (self.$field))) )*
					.finish()
			}
		}
	};

	(@ty optional ($ty:ty)) => { ::core::option::Option<$ty> };
	(@ty defaulted ($ty:ty)) => { $ty };
	(@ty required ($ty:ty)) => { $ty };

	(@get required ($ty:ty), $raw:expr, $var:expr, $secret:tt, $errors:ident, $profile:ident, []) => {
		$crate::settings::require::<$ty>($raw, &$var, $secret, &mut $errors)
	};
	(@get optional ($ty:ty), $raw:expr, $var:expr, $secret:tt, $errors:ident, $profile:ident, []) => {
		$crate::settings::optional::<$ty>($raw, &$var, $secret, &mut $errors)
	};
	(@get optional ($ty:ty), $raw:expr, $var:expr, $secret:tt, $errors:ident, $profile:ident, [$($req:literal),+]) => {
		$crate::settings::optional_required_in::<$ty>($raw, &$var, $secret, &mut $errors, &$profile, &[$($req),+])
	};
	(@get defaulted ($ty:ty), $raw:expr, $var:expr, $secret:tt, $errors:ident, $profile:ident, [], $default:literal) => {
		$crate::settings::with_default::<$ty>($raw, $default, &$var, $secret, &mut $errors)
	};
	(@get defaulted ($ty:ty), $raw:expr, $var:expr, $secret:tt, $errors:ident, $profile:ident, [$($req:literal),+], $default:literal) => {
		$crate::settings::with_default_required_in::<$ty>($raw, $default, &$var, $secret, &mut $errors, &$profile, &[$($req),+])
	};

	(@required_here required [], $profile:expr) => { true };
	(@required_here $kind:ident [], $profile:expr) => { false };
	(@required_here $kind:ident [$($req:literal),+], $profile:expr) => { [$($req),+].iter().any(|named| *named == $profile) };

	// An optional secret still shows *presence* (None vs Some("***")) — whether
	// a credential is set is not itself the secret, and hiding it would send
	// "why is X off?" debugging the wrong way.
	(@dbg true optional ($($e:tt)+)) => { &$($e)+.as_ref().map(|_| "***") };
	(@dbg true $kind:ident ($($e:tt)+)) => { &"***" };
	(@dbg false $kind:ident ($($e:tt)+)) => { &$($e)+ };
}
