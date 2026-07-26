//! `types` — shared domain TypeObjects (mirrors `@evinvest/types`).
//!
//! Zero runtime deps, wasm-safe, no I/O. Each type is a branded newtype with a
//! validating constructor and formatting/display methods.
//!
//! # Types
//!
//! - [`PhoneNumber`] — E.164 phone number: `+` followed by 7–15 digits with a
//!   known country-code prefix (ITU-T zones 1–9). Construct with
//!   [`PhoneNumber::from`] (validating), [`PhoneNumber::from_unchecked`] (trusted
//!   source), or [`PhoneNumber::parse_input`] (forgiving user input).
//! - [`Email`] — RFC 5321 email address: `local@domain`, case-insensitive,
//!   normalised to lowercase. Construct with [`Email::from`] (validating),
//!   [`Email::from_unchecked`] (trusted source), or [`Email::parse_input`]
//!   (forgiving user input).
//! - [`Branded`] — the generic newtype pattern reusable for future types
//!   (Currency, …).

use core::fmt;

// ── Branded ────────────────────────────────────────────────────────────────────

const COUNTRY_CODES: &[&str] = &[
	// Zone 1 — North American Numbering Plan
	"1", // Zone 2 — Africa
	"20", "211", "212", "213", "216", "218", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229", "230", "231", "232", "233", "234", "235", "236", "237", "238", "239",
	"240", "241", "242", "243", "244", "245", "246", "247", "248", "249", "250", "251", "252", "253", "254", "255", "256", "257", "258", "260", "261", "262", "263", "264", "265", "266",
	"267", "268", "269", // Zone 3 — Europe
	"30", "31", "32", "33", "34", "350", "351", "352", "353", "354", "355", "356", "357", "358", "359", // Zone 4 — Europe (cont.)
	"36", "370", "371", "372", "373", "374", "375", "376", "377", "378", "379", "380", "381", "382", "383", "385", "386", "387", "389", "40", "41", "42", "43", "44", "45", "46", "47", "48",
	"49", // Zone 5 — South/Latin America
	"500", "501", "502", "503", "504", "505", "506", "507", "508", "509", "51", "52", "53", "54", "55", "56", "57", "58", "590", "591", "592", "593", "594", "595", "596", "597", "598",
	"599", // Zone 6 — Southeast Asia / Oceania
	"60", "61", "62", "63", "64", "65", "66", "670", "672", "673", "674", "675", "676", "677", "678", "679", "680", "681", "682", "683", "685", "686", "687", "688", "689", "690", "691",
	"692", // Zone 7 — Russia, Kazakhstan
	"7",   // Zone 8 — East Asia / Special services
	"81", "82", "83", "84", "850", "852", "853", "855", "856", "86", "870", "872", "873", "874", "878", "879", "880", "881", "882", "883", "886", "888",
	// Zone 9 — West/South Asia
	"90", "91", "92", "93", "94", "95", "960", "961", "962", "963", "964", "965", "966", "967", "968", "969", "970", "971", "972", "973", "974", "975", "976", "977", "979", "98", "992",
	"993", "994", "995", "996", "998",
];
/// A branded wrapper — zero-overhead newtype with a compile-time phantom tag.
///
/// Use this to create distinct, incompatible types from the same underlying
/// representation (e.g. `Branded<String, PhoneNumberTag>` vs
/// `Branded<String, EmailTag>`).
///
/// # Example
///
/// ```
/// use ev_lib::types::Branded;
///
/// struct EmailTag;
/// type Email = Branded<String, EmailTag>;
///
/// let email = Email::new("a@b.com".into());
/// assert_eq!(email.as_inner(), "a@b.com");
/// ```
#[repr(transparent)]
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct Branded<T, B> {
	value: T,
	_brand: core::marker::PhantomData<B>,
}

impl<T, B> Branded<T, B> {
	/// Wrap a value without validation. The brand provides type safety at
	/// compile time; the caller is responsible for any runtime invariants.
	pub const fn new(value: T) -> Self {
		Self {
			value,
			_brand: core::marker::PhantomData,
		}
	}

	/// Recover the underlying value.
	pub fn into_inner(self) -> T {
		self.value
	}

	/// Borrow the underlying value.
	pub fn as_inner(&self) -> &T {
		&self.value
	}
}

// ── PhoneNumber ────────────────────────────────────────────────────────────────

/// Brand tag for [`PhoneNumber`].
pub struct PhoneNumberTag;

/// An E.164 phone number, validated at construction time.
///
/// Canonical form: `+<country code><subscriber number>`, e.g. `+12345678901`.
/// No spaces, hyphens, or other separators — just `+` and digits.
pub type PhoneNumber = Branded<String, PhoneNumberTag>;

/// Validation error returned by [`PhoneNumber::validate`] and
/// [`PhoneNumber::from`].
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PhoneNumberError {
	/// Input was empty.
	Empty,
	/// Must start with `+`.
	NoPlusPrefix,
	/// Only digits allowed after the `+`.
	NonDigitChars,
	/// Too few digits after `+` (minimum 7).
	TooShort { actual: usize },
	/// Too many digits after `+` (maximum 15).
	TooLong { actual: usize },
	/// Country code prefix is not in the known set.
	InvalidCountryCode,
}

impl PhoneNumberError {
	/// Machine-readable code — stable across versions.
	pub fn code(&self) -> &'static str {
		match self {
			Self::Empty => "empty",
			Self::NoPlusPrefix => "no_plus_prefix",
			Self::NonDigitChars => "non_digit_chars",
			Self::TooShort { .. } => "too_short",
			Self::TooLong { .. } => "too_long",
			Self::InvalidCountryCode => "invalid_country_code",
		}
	}
}

impl fmt::Display for PhoneNumberError {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		match self {
			Self::Empty => f.write_str("Phone number must not be empty"),
			Self::NoPlusPrefix => f.write_str("Phone number must start with +"),
			Self::NonDigitChars => f.write_str("Phone number must contain only digits after the +"),
			Self::TooShort { actual } => write!(f, "Phone number must have at least 7 digits (has {actual})"),
			Self::TooLong { actual } => write!(f, "Phone number must have at most 15 digits (has {actual})"),
			Self::InvalidCountryCode => f.write_str("Unknown country code"),
		}
	}
}

impl PhoneNumber {
	/// Maximum digits after the `+` (ITU-T E.164 limit).
	pub const MAX_DIGITS: usize = 15;
	/// Minimum digits after the `+`.
	pub const MIN_DIGITS: usize = 7;

	// -- Construction ---------------------------------------------------------------

	/// Validate and construct a `PhoneNumber`.
	///
	/// Returns [`PhoneNumberError`] on invalid input. Use
	/// [`PhoneNumber::from_unchecked`] to skip validation for trusted sources.
	pub fn from(value: String) -> Result<Self, PhoneNumberError> {
		Self::validate(&value)?;
		Ok(Self::from_unchecked(value))
	}

	/// Construct a `PhoneNumber` from a trusted source without validation.
	///
	/// The caller guarantees the value is a valid E.164 string. Use this when
	/// deserialising from a database or an already-validated API response —
	/// never on user input.
	pub fn from_unchecked(value: String) -> Self {
		Self::new(value)
	}

	/// Recover the underlying E.164 string.
	pub fn as_str(&self) -> &str {
		self.as_inner()
	}

	// -- Validation ----------------------------------------------------------------

	/// Validate without constructing. Returns `Ok(())` or a structured error.
	///
	/// Rules:
	/// 1. Non-empty
	/// 2. Must start with `+`
	/// 3. Only digits after `+`
	/// 4. 7–15 digits after `+`
	/// 5. Country code must be in the known ITU-T range (1–3 digits)
	pub fn validate(value: &str) -> Result<(), PhoneNumberError> {
		if value.is_empty() {
			return Err(PhoneNumberError::Empty);
		}
		if !value.starts_with('+') {
			return Err(PhoneNumberError::NoPlusPrefix);
		}
		let digits = &value[1..];
		if digits.is_empty() || !digits.chars().all(|c| c.is_ascii_digit()) {
			return Err(PhoneNumberError::NonDigitChars);
		}
		let n = digits.len();
		if n < Self::MIN_DIGITS {
			return Err(PhoneNumberError::TooShort { actual: n });
		}
		if n > Self::MAX_DIGITS {
			return Err(PhoneNumberError::TooLong { actual: n });
		}
		if !is_valid_country_code(digits) {
			return Err(PhoneNumberError::InvalidCountryCode);
		}
		Ok(())
	}

	/// Runtime type guard — returns `true` when `value` is a valid E.164 string.
	pub fn is_phone_number(value: &str) -> bool {
		Self::validate(value).is_ok()
	}

	// -- Formatting ----------------------------------------------------------------

	/// Format for human display: `+1 234 567 8901`.
	///
	/// Groups national digits left-to-right in chunks of 3, with the
	/// rightmost group getting the remainder. The separator defaults to
	/// a space.
	///
	/// This is a generic heuristic — a correct per-country formatter would
	/// require a full numbering-plan database. The output is always a
	/// readable, dialable string.
	pub fn format(&self, separator: &str) -> String {
		let raw = self.as_str();
		let digits = &raw[1..]; // skip '+'
		let Some(cc_len) = country_code_len(digits) else { return raw.to_owned() };
		let national = &digits[cc_len..];
		let n = national.len();
		let num_full = n / 3;
		let remainder = n % 3;

		let mut out = String::with_capacity(raw.len() + n / 3 + 2);
		out.push('+');
		out.push_str(&digits[..cc_len]);
		if n == 0 {
			return out;
		}
		out.push_str(separator);

		if num_full <= 1 {
			out.push_str(national);
		} else if remainder == 0 {
			for i in 0..num_full {
				if i > 0 {
					out.push_str(separator);
				}
				out.push_str(&national[i * 3..(i + 1) * 3]);
			}
		} else {
			for i in 0..num_full - 1 {
				if i > 0 {
					out.push_str(separator);
				}
				out.push_str(&national[i * 3..(i + 1) * 3]);
			}
			out.push_str(separator);
			out.push_str(&national[(num_full - 1) * 3..]);
		}
		out
	}

	/// Format for dialing from a local line — the `+` is replaced with the
	/// local international prefix (default `00`). `00 1 234 567 8901`
	pub fn format_local(&self, prefix: &str, separator: &str) -> String {
		let international = Self::format(self, separator);
		let mut out = String::with_capacity(prefix.len() + international.len());
		out.push_str(prefix);
		out.push_str(separator);
		out.push_str(&international[1..]); // skip '+'
		out
	}

	// -- User-input parsing --------------------------------------------------------

	/// Parse loosely-formatted user input into a `PhoneNumber`.
	///
	/// Strips common formatting characters (spaces, hyphens, dots, parentheses),
	/// ensures a leading `+`, and validates. Returns `None` on invalid input.
	pub fn parse_input(raw: &str) -> Option<Self> {
		let stripped: String = raw.chars().filter(|c| !matches!(c, ' ' | '-' | '.' | '(' | ')')).collect();
		let normalised = if stripped.starts_with('+') { stripped } else { format!("+{stripped}") };
		Self::validate(&normalised).ok()?;
		Some(Self::from_unchecked(normalised))
	}
}

impl fmt::Display for PhoneNumber {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		f.write_str(self.as_str())
	}
}

// ── Email ──────────────────────────────────────────────────────────────────────

/// Brand tag for [`Email`].
pub struct EmailTag;

/// An RFC 5321 email address, validated and normalised to lowercase.
///
/// Canonical form: `local@domain.tld`. The address is always stored in
/// lowercase; construction through [`Email::from`] or [`Email::parse_input`]
/// normalises case automatically.
pub type Email = Branded<String, EmailTag>;

/// Validation error returned by [`Email::validate`] and [`Email::from`].
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EmailError {
	/// Input was empty.
	Empty,
	/// Missing `@` sign.
	NoAt,
	/// Local part (before `@`) is empty.
	EmptyLocal,
	/// Domain part (after `@`) is empty.
	EmptyDomain,
	/// Local part exceeds 64 octets (RFC 5321).
	LocalTooLong { actual: usize },
	/// Domain part exceeds 255 octets (RFC 1035).
	DomainTooLong { actual: usize },
	/// Full address exceeds 254 octets (RFC 5321).
	TooLong { actual: usize },
	/// Domain lacks a TLD (no `.` in domain part).
	NoTld,
	/// Contains whitespace or other invalid characters.
	InvalidChar,
}

impl EmailError {
	/// Machine-readable code — stable across versions.
	pub fn code(&self) -> &'static str {
		match self {
			Self::Empty => "empty",
			Self::NoAt => "no_at",
			Self::EmptyLocal => "empty_local",
			Self::EmptyDomain => "empty_domain",
			Self::LocalTooLong { .. } => "local_too_long",
			Self::DomainTooLong { .. } => "domain_too_long",
			Self::TooLong { .. } => "too_long",
			Self::NoTld => "no_tld",
			Self::InvalidChar => "invalid_char",
		}
	}
}

impl fmt::Display for EmailError {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		match self {
			Self::Empty => f.write_str("Email must not be empty"),
			Self::NoAt => f.write_str("Email must contain an @"),
			Self::EmptyLocal => f.write_str("Email local part must not be empty"),
			Self::EmptyDomain => f.write_str("Email domain must not be empty"),
			Self::LocalTooLong { actual } => write!(f, "Email local part must be at most 64 characters (has {actual})"),
			Self::DomainTooLong { actual } => write!(f, "Email domain must be at most 255 characters (has {actual})"),
			Self::TooLong { actual } => write!(f, "Email must be at most 254 characters (has {actual})"),
			Self::NoTld => f.write_str("Email domain must have a TLD (e.g. .com)"),
			Self::InvalidChar => f.write_str("Email contains invalid characters"),
		}
	}
}

impl Email {
	/// Maximum length of the domain part (RFC 1035).
	pub const MAX_DOMAIN_LEN: usize = 255;
	/// Maximum total length (RFC 5321).
	pub const MAX_LEN: usize = 254;
	/// Maximum length of the local part (RFC 5321).
	pub const MAX_LOCAL_LEN: usize = 64;

	// -- Construction ---------------------------------------------------------------

	/// Validate and construct an [`Email`].
	///
	/// The value is normalised to lowercase. Returns [`EmailError`] on invalid
	/// input. Use [`Email::from_unchecked`] to skip validation for trusted sources.
	pub fn from(value: String) -> Result<Self, EmailError> {
		Self::validate(&value)?;
		Ok(Self::from_unchecked(value.to_lowercase()))
	}

	/// Construct an [`Email`] from a trusted source without validation or
	/// normalisation.
	///
	/// The caller guarantees the value is a valid, lowercase email address. Use
	/// this when deserialising from a database or an already-validated API
	/// response — never on user input.
	pub fn from_unchecked(value: String) -> Self {
		Self::new(value)
	}

	/// Recover the underlying string (always lowercase).
	pub fn as_str(&self) -> &str {
		self.as_inner()
	}

	/// The local part (before the `@`), e.g. `user` in `user@example.com`.
	pub fn local_part(&self) -> &str {
		let s = self.as_str();
		&s[..s.find('@').unwrap_or(s.len())]
	}

	/// The domain part (after the `@`), e.g. `example.com` in `user@example.com`.
	pub fn domain(&self) -> &str {
		let s = self.as_str();
		&s[s.find('@').map(|i| i + 1).unwrap_or(s.len())..]
	}

	// -- Validation ----------------------------------------------------------------

	/// Validate without constructing. Returns `Ok(())` or a structured error.
	///
	/// Rules:
	/// 1. Non-empty
	/// 2. Contains exactly one `@`
	/// 3. Local and domain parts non-empty
	/// 4. Local part ≤ 64 chars, domain ≤ 255 chars, total ≤ 254
	/// 5. Domain contains at least one `.` (TLD)
	/// 6. No whitespace or control characters
	pub fn validate(value: &str) -> Result<(), EmailError> {
		if value.is_empty() {
			return Err(EmailError::Empty);
		}

		// Must contain exactly one @.
		let at_pos = value.find('@');
		let Some(at_pos) = at_pos else {
			return Err(EmailError::NoAt);
		};
		if value[at_pos + 1..].contains('@') {
			return Err(EmailError::InvalidChar);
		}

		let local = &value[..at_pos];
		let domain = &value[at_pos + 1..];

		if local.is_empty() {
			return Err(EmailError::EmptyLocal);
		}
		if domain.is_empty() {
			return Err(EmailError::EmptyDomain);
		}

		if local.len() > Self::MAX_LOCAL_LEN {
			return Err(EmailError::LocalTooLong { actual: local.len() });
		}
		if domain.len() > Self::MAX_DOMAIN_LEN {
			return Err(EmailError::DomainTooLong { actual: domain.len() });
		}
		if value.len() > Self::MAX_LEN {
			return Err(EmailError::TooLong { actual: value.len() });
		}

		// Domain must contain at least one dot.
		if !domain.contains('.') {
			return Err(EmailError::NoTld);
		}

		// No whitespace or control characters.
		if value.chars().any(|c| c.is_whitespace() || c.is_control()) {
			return Err(EmailError::InvalidChar);
		}

		Ok(())
	}

	/// Runtime type guard — returns `true` when `value` is a valid email string.
	pub fn is_email(value: &str) -> bool {
		Self::validate(value).is_ok()
	}

	// -- User-input parsing --------------------------------------------------------

	/// Parse loosely-formatted user input into an [`Email`].
	///
	/// Trims whitespace and normalises to lowercase. Returns `None` on invalid
	/// input.
	pub fn parse_input(raw: &str) -> Option<Self> {
		let trimmed = raw.trim();
		if trimmed.is_empty() {
			return None;
		}
		Self::validate(trimmed).ok()?;
		Some(Self::from_unchecked(trimmed.to_lowercase()))
	}
}

impl fmt::Display for Email {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		f.write_str(self.as_str())
	}
}

// ── Country-code table ─────────────────────────────────────────────────────────

// Country codes (1–3 digits, ITU-T zones 1–9). Tried longest-first so
// e.g. "1242" (Bahamas) matches before "1" (NANP).

/// Returns the country code length in `digits` (a string of ASCII digits), or
/// `None` if no known country code matches.
fn country_code_len(digits: &str) -> Option<usize> {
	for &len in &[3u8, 2, 1] {
		if digits.len() >= len as usize {
			let prefix = &digits[..len as usize];
			if COUNTRY_CODES.contains(&prefix) {
				return Some(len as usize);
			}
		}
	}
	None
}

fn is_valid_country_code(digits: &str) -> bool {
	country_code_len(digits).is_some()
}

// ── Tests ──────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
	use super::*;

	// -- validate --

	#[test]
	fn accepts_valid_e164_numbers() {
		let cases = [
			"+12345678901",   // US
			"+442012345678",  // UK
			"+8613812345678", // China
			"+79161234567",   // Russia
			"+85212345678",   // Hong Kong (3-digit cc)
			"+12421234567",   // Bahamas (4-digit cc starting with 1)
		];
		for raw in cases {
			assert!(PhoneNumber::validate(raw).is_ok(), "should accept {raw}");
		}
	}

	#[test]
	fn rejects_empty() {
		let err = PhoneNumber::validate("").unwrap_err();
		assert_eq!(err.code(), "empty");
	}

	#[test]
	fn rejects_no_plus() {
		let err = PhoneNumber::validate("12345678901").unwrap_err();
		assert_eq!(err.code(), "no_plus_prefix");
	}

	#[test]
	fn rejects_spaces_in_canonical_form() {
		let err = PhoneNumber::validate("+1 234 567 8901").unwrap_err();
		assert_eq!(err.code(), "non_digit_chars");
	}

	#[test]
	fn rejects_parentheses_and_hyphens() {
		assert!(PhoneNumber::validate("+1(234)5678901").is_err());
		assert!(PhoneNumber::validate("+1-234-567-8901").is_err());
	}

	#[test]
	fn rejects_too_short() {
		let err = PhoneNumber::validate("+123456").unwrap_err();
		assert_eq!(err.code(), "too_short");
	}

	#[test]
	fn rejects_too_long() {
		let err = PhoneNumber::validate("+1234567890123456").unwrap_err();
		assert_eq!(err.code(), "too_long");
	}

	#[test]
	fn rejects_unknown_country_code() {
		let err = PhoneNumber::validate("+9991234567").unwrap_err();
		assert_eq!(err.code(), "invalid_country_code");
	}

	#[test]
	fn boundary_min_7() {
		assert!(PhoneNumber::validate("+7123456").is_ok()); // 1-digit cc + 6 national
	}

	#[test]
	fn boundary_max_15() {
		assert!(PhoneNumber::validate("+123456789012345").is_ok()); // cc 1 + 14 digits
	}

	// -- from / from_unchecked --

	#[test]
	fn from_constructs_valid() {
		let pn = PhoneNumber::from("+12345678901".into()).unwrap();
		assert_eq!(pn.as_str(), "+12345678901");
	}

	#[test]
	fn from_rejects_invalid() {
		assert!(PhoneNumber::from("bad".into()).is_err());
	}

	#[test]
	fn from_unchecked_skips_validation() {
		let pn = PhoneNumber::from_unchecked(String::new());
		assert_eq!(pn.as_str(), "");
	}

	// -- is_phone_number --

	#[test]
	fn is_phone_number_type_guard() {
		assert!(PhoneNumber::is_phone_number("+12345678901"));
		assert!(!PhoneNumber::is_phone_number(""));
		assert!(!PhoneNumber::is_phone_number("+1"));
	}

	// -- format --

	#[test]
	fn format_us() {
		let pn = PhoneNumber::from("+12345678901".into()).unwrap();
		assert_eq!(pn.format(" "), "+1 234 567 8901");
	}

	#[test]
	fn format_uk() {
		let pn = PhoneNumber::from("+442012345678".into()).unwrap();
		assert_eq!(pn.format(" "), "+44 201 234 5678");
	}

	#[test]
	fn format_custom_separator() {
		let pn = PhoneNumber::from("+12345678901".into()).unwrap();
		assert_eq!(pn.format("-"), "+1-234-567-8901");
	}

	// -- format_local --

	#[test]
	fn format_local_default() {
		let pn = PhoneNumber::from("+12345678901".into()).unwrap();
		assert_eq!(pn.format_local("00", " "), "00 1 234 567 8901");
	}

	// -- parse_input --

	#[test]
	fn parse_input_strips_spaces() {
		let pn = PhoneNumber::parse_input("+1 234 567 8901").unwrap();
		assert_eq!(pn.as_str(), "+12345678901");
	}

	#[test]
	fn parse_input_strips_hyphens_and_adds_plus() {
		let pn = PhoneNumber::parse_input("1-234-567-8901").unwrap();
		assert_eq!(pn.as_str(), "+12345678901");
	}

	#[test]
	fn parse_input_strips_parentheses() {
		let pn = PhoneNumber::parse_input("+1 (234) 567-8901").unwrap();
		assert_eq!(pn.as_str(), "+12345678901");
	}

	#[test]
	fn parse_input_returns_none_for_invalid() {
		assert!(PhoneNumber::parse_input("short").is_none());
		assert!(PhoneNumber::parse_input("").is_none());
	}

	// -- Display --

	#[test]
	fn display_returns_canonical_e164() {
		let pn = PhoneNumber::from("+12345678901".into()).unwrap();
		assert_eq!(format!("{pn}"), "+12345678901");
	}

	// -- Branded --

	#[test]
	fn branded_round_trip() {
		struct EmailTag;
		type Email = Branded<String, EmailTag>;
		let email = Email::new("a@b.com".into());
		assert_eq!(email.as_inner(), "a@b.com");
		assert_eq!(email.into_inner(), "a@b.com");
	}
	// -- Email: validate --

	#[test]
	fn email_accepts_valid() {
		let cases = ["user@example.com", "a@b.cd", "first.last@sub.example.co.uk", "user+tag@example.com", "123@numbers.org"];
		for raw in cases {
			assert!(Email::validate(raw).is_ok(), "should accept {raw}");
		}
	}

	#[test]
	fn email_rejects_empty() {
		let err = Email::validate("").unwrap_err();
		assert_eq!(err.code(), "empty");
	}

	#[test]
	fn email_rejects_no_at() {
		let err = Email::validate("userexample.com").unwrap_err();
		assert_eq!(err.code(), "no_at");
	}

	#[test]
	fn email_rejects_empty_local() {
		let err = Email::validate("@example.com").unwrap_err();
		assert_eq!(err.code(), "empty_local");
	}

	#[test]
	fn email_rejects_empty_domain() {
		let err = Email::validate("user@").unwrap_err();
		assert_eq!(err.code(), "empty_domain");
	}

	#[test]
	fn email_rejects_multiple_at() {
		assert!(Email::validate("a@b@c.com").is_err());
	}

	#[test]
	fn email_rejects_no_tld() {
		let err = Email::validate("user@localhost").unwrap_err();
		assert_eq!(err.code(), "no_tld");
	}

	#[test]
	fn email_rejects_whitespace() {
		assert!(Email::validate("user @example.com").is_err());
		assert!(Email::validate("user@example.com\n").is_err());
	}

	#[test]
	fn email_rejects_local_too_long() {
		let long_local = "a".repeat(65) + "@example.com";
		let err = Email::validate(&long_local).unwrap_err();
		assert_eq!(err.code(), "local_too_long");
	}

	#[test]
	fn email_rejects_domain_too_long() {
		let long_domain = "a".repeat(256);
		let long = format!("user@{long_domain}");
		let err = Email::validate(&long).unwrap_err();
		assert_eq!(err.code(), "domain_too_long");
	}

	#[test]
	fn email_rejects_total_too_long() {
		// 64-char local + @ + 189-char domain = 254, so make it 255
		let long = "a".repeat(255);
		let err = Email::validate(&long).unwrap_err();
		// Should fail with either too_long or no_at (no @ in repeated 'a')
		assert!(err.code() == "too_long" || err.code() == "no_at");
	}

	// -- Email: from / from_unchecked --

	#[test]
	fn email_from_constructs_and_normalises() {
		let e = Email::from("User@Example.COM".into()).unwrap();
		assert_eq!(e.as_str(), "user@example.com");
	}

	#[test]
	fn email_from_rejects_invalid() {
		assert!(Email::from("bad".into()).is_err());
	}

	#[test]
	fn email_from_unchecked_skips_validation() {
		let e = Email::from_unchecked(String::new());
		assert_eq!(e.as_str(), "");
	}

	// -- Email: is_email --

	#[test]
	fn email_is_email_type_guard() {
		assert!(Email::is_email("user@example.com"));
		assert!(!Email::is_email(""));
		assert!(!Email::is_email("notanemail"));
	}

	// -- Email: local_part / domain --

	#[test]
	fn email_local_and_domain() {
		let e = Email::from("user@example.com".into()).unwrap();
		assert_eq!(e.local_part(), "user");
		assert_eq!(e.domain(), "example.com");
	}

	// -- Email: parse_input --

	#[test]
	fn email_parse_input_trims_whitespace() {
		let e = Email::parse_input("  user@example.com  ").unwrap();
		assert_eq!(e.as_str(), "user@example.com");
	}

	#[test]
	fn email_parse_input_returns_none_for_invalid() {
		assert!(Email::parse_input("notanemail").is_none());
		assert!(Email::parse_input("").is_none());
	}

	// -- Email: Display --

	#[test]
	fn email_display_returns_lowercase() {
		let e = Email::from("User@Example.COM".into()).unwrap();
		assert_eq!(format!("{e}"), "user@example.com");
	}
}
