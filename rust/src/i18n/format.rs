//! The ICU-subset message formatter.
//!
//! Supported: `{name}` interpolation, `{n, plural, …}` (with `=N` exact matches
//! and `#` for the count), `{k, select, …}`, and `'` escaping for literal
//! braces. Not supported, on purpose: `number`, `date`, `currency` and `plural`
//! offsets — see the module note on why formatting policy stays in the
//! consuming app.
//!
//! Malformed patterns degrade to the text as written rather than panicking; a
//! copy typo must not take a view down.

use std::collections::BTreeMap;

use super::Locale;

/// A value interpolated into a message pattern.
#[derive(Debug, Clone, PartialEq)]
pub enum MessageValue {
	Str(String),
	Num(f64),
}

impl MessageValue {
	fn render(&self) -> String {
		match self {
			Self::Str(s) => s.clone(),
			// Integral floats render without a trailing ".0" — `{n}` in copy is a
			// count, and "3 rooms" is what a reader expects, not "3.0 rooms".
			Self::Num(n) if n.fract() == 0.0 && n.is_finite() => format!("{}", *n as i64),
			Self::Num(n) => n.to_string(),
		}
	}

	fn as_number(&self) -> Option<f64> {
		match self {
			Self::Num(n) => Some(*n),
			Self::Str(s) => s.trim().parse().ok(),
		}
	}
}

impl From<&str> for MessageValue {
	fn from(value: &str) -> Self {
		Self::Str(value.to_owned())
	}
}

impl From<String> for MessageValue {
	fn from(value: String) -> Self {
		Self::Str(value)
	}
}

macro_rules! from_number {
	($($t:ty),*) => {
		$(impl From<$t> for MessageValue {
			fn from(value: $t) -> Self { Self::Num(value as f64) }
		})*
	};
}
from_number!(i8, i16, i32, i64, isize, u8, u16, u32, u64, usize, f32, f64);

/// Values interpolated into a message pattern, keyed by argument name.
pub type MessageValues = BTreeMap<String, MessageValue>;

/// Format one ICU-subset pattern.
///
/// ```
/// use ev_lib::i18n::{Locale, MessageValue, MessageValues, format_message};
/// let mut v = MessageValues::new();
/// v.insert("name".into(), MessageValue::from("Quy Nhơn"));
/// assert_eq!(format_message("Hello, {name}.", Locale::En, &v), "Hello, Quy Nhơn.");
/// ```
pub fn format_message(pattern: &str, locale: Locale, values: &MessageValues) -> String {
	let chars: Vec<char> = pattern.chars().collect();
	format(&chars, locale, values, None)
}

/// The formatter proper. `pound` is the already-formatted count when rendering
/// inside a plural branch, and `None` everywhere else — threading it through
/// (rather than string-replacing `#` afterwards) is what lets `'#'` stay
/// escapable and keeps `#` literal outside a plural, as ICU specifies.
fn format(pattern: &[char], locale: Locale, values: &MessageValues, pound: Option<&str>) -> String {
	let mut out = String::new();
	let mut i = 0;

	while i < pattern.len() {
		let ch = pattern[i];

		// ICU's apostrophe-friendly quoting (the ICU 4.8+ rules every modern
		// toolchain implements): an apostrophe only starts a quoted section when
		// it immediately precedes a syntax character, and that section runs to the
		// next apostrophe. Anywhere else it is a plain apostrophe — which matters,
		// since English marketing copy is full of them and the naive "quote
		// escapes the next character" reading mangles every "we've" and "don't".
		if ch == '\'' {
			let next = pattern.get(i + 1).copied();
			if next == Some('\'') {
				out.push('\'');
				i += 2;
				continue;
			}
			if matches!(next, Some('{') | Some('}') | Some('#')) {
				i += 1;
				while i < pattern.len() {
					if pattern[i] == '\'' {
						if pattern.get(i + 1) == Some(&'\'') {
							out.push('\'');
							i += 2;
							continue;
						}
						i += 1;
						break;
					}
					out.push(pattern[i]);
					i += 1;
				}
				continue;
			}
			out.push(ch);
			i += 1;
			continue;
		}

		if ch == '#'
			&& let Some(pound) = pound
		{
			out.push_str(pound);
			i += 1;
			continue;
		}

		if ch == '{' {
			match match_brace(pattern, i) {
				Some(end) => {
					out.push_str(&render_argument(&pattern[i + 1..end], locale, values, pound));
					i = end + 1;
				}
				// Unbalanced — emit the rest verbatim rather than losing the copy.
				None => {
					out.extend(&pattern[i..]);
					break;
				}
			}
			continue;
		}

		out.push(ch);
		i += 1;
	}

	out
}

/// Index of the `}` closing the `{` at `start`, or `None` if unbalanced.
fn match_brace(source: &[char], start: usize) -> Option<usize> {
	let mut depth = 0usize;
	for (offset, ch) in source[start..].iter().enumerate() {
		match ch {
			'{' => depth += 1,
			'}' => {
				depth -= 1;
				if depth == 0 {
					return Some(start + offset);
				}
			}
			_ => {}
		}
	}
	None
}

/// Index of the first `sep` not nested inside braces.
fn top_level_index_of(source: &[char], sep: char) -> Option<usize> {
	let mut depth = 0i32;
	for (i, &ch) in source.iter().enumerate() {
		match ch {
			'{' => depth += 1,
			'}' => depth -= 1,
			c if c == sep && depth == 0 => return Some(i),
			_ => {}
		}
	}
	None
}

fn render_argument(inner: &[char], locale: Locale, values: &MessageValues, pound: Option<&str>) -> String {
	let verbatim = || -> String { format!("{{{}}}", inner.iter().collect::<String>()) };

	let Some(first_comma) = top_level_index_of(inner, ',') else {
		// `{name}` — plain interpolation.
		let name: String = inner.iter().collect::<String>().trim().to_owned();
		return match values.get(&name) {
			Some(value) => value.render(),
			None => verbatim(),
		};
	};

	let name: String = inner[..first_comma].iter().collect::<String>().trim().to_owned();
	let rest = &inner[first_comma + 1..];
	let second_comma = top_level_index_of(rest, ',');
	let arg_type: String = match second_comma {
		Some(idx) => rest[..idx].iter().collect::<String>(),
		None => rest.iter().collect::<String>(),
	}
	.trim()
	.to_owned();
	let body: &[char] = match second_comma {
		Some(idx) => &rest[idx + 1..],
		None => &[],
	};
	let raw = values.get(&name);

	match arg_type.as_str() {
		"plural" => {
			let Some(count) = raw.and_then(MessageValue::as_number).filter(|n| n.is_finite()) else {
				return String::new();
			};
			let branches = parse_branches(body);
			// An `=N` exact match wins over the category, per ICU. Rendered via the
			// same integral rule as `{n}` so `=1` matches a count of 1.0.
			let exact = if count.fract() == 0.0 { branches.get(&format!("={}", count as i64)) } else { None };
			let category = locale.select_plural(count);
			let chosen = exact.or_else(|| branches.get(category.as_str())).or_else(|| branches.get("other"));
			match chosen {
				// `#` is the count in the reader's locale — ru groups with no-break
				// spaces, de with dots.
				Some(branch) => format(branch, locale, values, Some(&locale.format_number(count))),
				None => String::new(),
			}
		}
		"select" => {
			let branches = parse_branches(body);
			let key = raw.map(MessageValue::render).unwrap_or_default();
			let chosen = branches.get(key.as_str()).or_else(|| branches.get("other"));
			match chosen {
				// `pound` flows through: a select nested inside a plural keeps `#`
				// bound to the enclosing count, per ICU.
				Some(branch) => format(branch, locale, values, pound),
				None => String::new(),
			}
		}
		// Unknown argument type — fall back to interpolation so the copy still reads.
		_ => match raw {
			Some(value) => value.render(),
			None => verbatim(),
		},
	}
}

/// Parse `key {body} key {body}` branch lists.
fn parse_branches(body: &[char]) -> BTreeMap<String, Vec<char>> {
	let mut branches = BTreeMap::new();
	let mut i = 0;
	while i < body.len() {
		while i < body.len() && body[i].is_whitespace() {
			i += 1;
		}
		let key_start = i;
		while i < body.len() && !body[i].is_whitespace() && body[i] != '{' {
			i += 1;
		}
		let key: String = body[key_start..i].iter().collect();
		while i < body.len() && body[i].is_whitespace() {
			i += 1;
		}
		if body.get(i) != Some(&'{') {
			break;
		}
		let Some(end) = match_brace(body, i) else { break };
		if !key.is_empty() {
			branches.insert(key, body[i + 1..end].to_vec());
		}
		i = end + 1;
	}
	branches
}
