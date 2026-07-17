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
/// ```
///
/// Generated API: the struct itself (fields `pub`, `Clone`, redacting `Debug`),
/// `from_env()`, `from_source(impl FnMut(&str) -> Option<String>)`, and
/// `var_names()` (every var the struct reads, in declaration order — handy for
/// generating a `.env.example`).
///
/// Field grammar: `#[secret]` and/or `#[env("NAME")]` (plus doc comments), then
/// `name: Type`, `name: Type = "default"`, or `name: Option<Type>`. Write
/// `Option` literally — the macro matches it by name. An `Option` field cannot
/// take a default (a defaulted field is always present).
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
	// `{ [docs] name (kind) (type) secret (env override) (default?) }` ----

	(@parse $meta:tt $vis:tt $name:ident $prefix:tt $acc:tt) => {
		$crate::settings! { @emit $meta $vis $name $prefix $acc }
	};
	(@parse $meta:tt $vis:tt $name:ident $prefix:tt $acc:tt $($rest:tt)+) => {
		$crate::settings! { @attrs $meta $vis $name $prefix $acc [] false (::core::option::Option::None) $($rest)+ }
	};

	// strip field attributes (doc comments, #[secret], #[env("NAME")]) in any order
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt $acc:tt [$($docs:tt)*] $secret:tt $env:tt #[doc $($doc:tt)+] $($rest:tt)+) => {
		$crate::settings! { @attrs $meta $vis $name $prefix $acc [$($docs)* #[doc $($doc)+]] $secret $env $($rest)+ }
	};
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt $acc:tt $docs:tt $secret:tt $env:tt #[secret] $($rest:tt)+) => {
		$crate::settings! { @attrs $meta $vis $name $prefix $acc $docs true $env $($rest)+ }
	};
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt $acc:tt $docs:tt $secret:tt $env:tt #[env($var:literal)] $($rest:tt)+) => {
		$crate::settings! { @attrs $meta $vis $name $prefix $acc $docs $secret (::core::option::Option::Some($var)) $($rest)+ }
	};

	// field shapes; `Option` arms first so the general `$ty:ty` arms don't swallow them
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt $acc:tt $docs:tt $secret:tt $env:tt $field:ident: Option<$ty:ty> = $default:literal $($rest:tt)*) => {
		::core::compile_error!("an `Option` settings field cannot take a default: drop the `Option` (a defaulted field is always present) or drop the default");
	};
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt [$($acc:tt)*] $docs:tt $secret:tt $env:tt $field:ident: Option<$ty:ty> $(, $($rest:tt)*)?) => {
		$crate::settings! { @parse $meta $vis $name $prefix [$($acc)* { $docs $field (optional) ($ty) $secret $env () }] $($($rest)*)? }
	};
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt [$($acc:tt)*] $docs:tt $secret:tt $env:tt $field:ident: $ty:ty = $default:literal $(, $($rest:tt)*)?) => {
		$crate::settings! { @parse $meta $vis $name $prefix [$($acc)* { $docs $field (defaulted) ($ty) $secret $env ($default) }] $($($rest)*)? }
	};
	(@attrs $meta:tt $vis:tt $name:ident $prefix:tt [$($acc:tt)*] $docs:tt $secret:tt $env:tt $field:ident: $ty:ty $(, $($rest:tt)*)?) => {
		$crate::settings! { @parse $meta $vis $name $prefix [$($acc)* { $docs $field (required) ($ty) $secret $env () }] $($($rest)*)? }
	};

	// ---- emission ----

	(@emit [$(#[$meta:meta])*] ($vis:vis) $name:ident ($prefix:expr) [$({ [$($docs:tt)*] $field:ident ($kind:ident) ($ty:ty) $secret:tt ($env:expr) ($($default:literal)?) })*]) => {
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
				$(
					let $field = {
						let var = $crate::settings::env_name($prefix, $env, ::core::stringify!($field));
						let raw = $crate::settings::lookup(&mut source, &var);
						$crate::settings!(@get $kind ($ty), raw, var, $secret, errors $(, $default)?)
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

	(@get required ($ty:ty), $raw:expr, $var:expr, $secret:tt, $errors:ident) => {
		$crate::settings::require::<$ty>($raw, &$var, $secret, &mut $errors)
	};
	(@get optional ($ty:ty), $raw:expr, $var:expr, $secret:tt, $errors:ident) => {
		$crate::settings::optional::<$ty>($raw, &$var, $secret, &mut $errors)
	};
	(@get defaulted ($ty:ty), $raw:expr, $var:expr, $secret:tt, $errors:ident, $default:literal) => {
		$crate::settings::with_default::<$ty>($raw, $default, &$var, $secret, &mut $errors)
	};

	// An optional secret still shows *presence* (None vs Some("***")) — whether
	// a credential is set is not itself the secret, and hiding it would send
	// "why is X off?" debugging the wrong way.
	(@dbg true optional ($($e:tt)+)) => { &$($e)+.as_ref().map(|_| "***") };
	(@dbg true $kind:ident ($($e:tt)+)) => { &"***" };
	(@dbg false $kind:ident ($($e:tt)+)) => { &$($e)+ };
}
