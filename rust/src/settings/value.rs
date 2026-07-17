//! [`FromEnvValue`] — how a raw env string becomes a typed value.
//!
//! The impls below define the shared Rust↔TS parsing contract: `bool` accepts
//! `true`/`false`/`1`/`0` case-insensitively, `Vec<T>` is comma-separated with
//! trimmed items and empty items dropped, and scalars are **not** trimmed —
//! `" 8080"` is invalid for a number on both sides. Everything else delegates
//! to `FromStr`.

/// Parse one env value into a typed field.
///
/// Implemented for `String`, `bool` (contract semantics), the integer/float
/// primitives, `char`, `PathBuf`, the `std::net` address types, and
/// `Vec<T: FromEnvValue>`. For your own `FromStr` types, use
/// [`settings_via_from_str!`](crate::settings_via_from_str):
///
/// ```
/// #[derive(Clone, Debug, PartialEq)]
/// struct Region(String);
///
/// impl std::str::FromStr for Region {
///     type Err = String;
///     fn from_str(raw: &str) -> Result<Self, Self::Err> {
///         match raw {
///             "eu" | "us" => Ok(Region(raw.to_string())),
///             _ => Err("expected one of `eu`, `us`".to_string()),
///         }
///     }
/// }
///
/// ev_lib::settings_via_from_str!(Region);
///
/// use ev_lib::settings::FromEnvValue;
/// assert_eq!(Region::from_env_value("eu"), Ok(Region("eu".to_string())));
/// assert!(Region::from_env_value("mars").is_err());
/// ```
pub trait FromEnvValue: Sized {
	/// Parse `raw`. An env value is never empty here (the empty string is
	/// normalised to *unset* before parsing), but a `= ""` default literal
	/// does arrive empty. The error string ends up in the aggregate
	/// [`SettingsError`](crate::settings::SettingsError) message.
	fn from_env_value(raw: &str) -> Result<Self, String>;
}

impl FromEnvValue for String {
	fn from_env_value(raw: &str) -> Result<Self, String> {
		Ok(raw.to_string())
	}
}

/// Contract: `true`/`1` and `false`/`0`, ASCII case-insensitive. No trimming —
/// `" true"` is invalid, matching the TS mirror.
impl FromEnvValue for bool {
	fn from_env_value(raw: &str) -> Result<Self, String> {
		match raw.to_ascii_lowercase().as_str() {
			"true" | "1" => Ok(true),
			"false" | "0" => Ok(false),
			_ => Err("expected one of `true`, `false`, `1`, `0` (case-insensitive)".to_string()),
		}
	}
}

/// Contract: split on `,`, trim each item, drop empty items, parse the rest.
/// Item numbering in errors counts the kept items, starting at 1. Error
/// messages carry the item *position*, never the item value, so secret lists
/// stay redactable. Trimming also strips U+FEFF (BOM), which JS `trim()`
/// removes but Rust `str::trim` keeps — the TS mirror pins this vector.
impl<T: FromEnvValue> FromEnvValue for Vec<T> {
	fn from_env_value(raw: &str) -> Result<Self, String> {
		raw.split(',')
			.map(|item| item.trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}'))
			.filter(|item| !item.is_empty())
			.enumerate()
			.map(|(index, item)| T::from_env_value(item).map_err(|error| format!("item {}: {error}", index + 1)))
			.collect()
	}
}

/// Implement [`FromEnvValue`](crate::settings::FromEnvValue) for types that
/// already implement `FromStr` — the escape hatch for consumer newtypes and
/// enums (see the trait docs for an example).
#[macro_export]
macro_rules! settings_via_from_str {
	($($ty:ty),+ $(,)?) => {$(
		impl $crate::settings::FromEnvValue for $ty {
			fn from_env_value(raw: &str) -> ::core::result::Result<Self, ::std::string::String> {
				raw.parse::<$ty>().map_err(|error| ::std::string::ToString::to_string(&error))
			}
		}
	)+};
}

crate::settings_via_from_str!(
	u8,
	u16,
	u32,
	u64,
	u128,
	usize,
	i8,
	i16,
	i32,
	i64,
	i128,
	isize,
	f32,
	f64,
	char,
	std::path::PathBuf,
	std::net::IpAddr,
	std::net::Ipv4Addr,
	std::net::Ipv6Addr,
	std::net::SocketAddr,
	std::net::SocketAddrV4,
	std::net::SocketAddrV6,
);
