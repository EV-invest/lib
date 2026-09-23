//! An ordered JSON value — what the builders here emit: JSON-LD graphs, the
//! Next `Metadata` shape, the sitemap.
//!
//! Its own type rather than `serde_json::Value` for two reasons. Key order is
//! part of the contract — the shared fixtures compare serialised text, byte for
//! byte with the TypeScript port — and `serde_json` only keeps insertion order
//! behind a crate-wide feature that would change every other consumer's maps.
//! And the feature stays free of a serialisation stack for a few hundred bytes
//! of `<script type="application/ld+json">`.

/// One JSON value. Objects keep their insertion order.
#[derive(Clone, Debug, PartialEq)]
pub enum Json {
	Null,
	Bool(bool),
	Num(f64),
	Str(String),
	List(Vec<Json>),
	Object(Object),
}

/// A JSON object in insertion order.
///
/// Setting a key that is already present replaces its value in place, which is
/// what a JavaScript object literal with a repeated or spread key does — the
/// TypeScript builders rely on it, so this one must too.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Object(Vec<(String, Json)>);

impl Object {
	pub fn new() -> Self {
		Self::default()
	}

	/// `{ "@type": type_ }`, the head of every schema.org node.
	pub fn typed(type_: impl Into<String>) -> Self {
		Self::new().with("@type", type_.into())
	}

	/// `{ "@id": id }`, a reference to a node defined elsewhere in the graph.
	pub fn reference(id: impl Into<String>) -> Self {
		Self::new().with("@id", id.into())
	}

	#[must_use]
	pub fn with(mut self, key: &str, value: impl Into<Json>) -> Self {
		self.set(key, value);
		self
	}

	pub fn set(&mut self, key: &str, value: impl Into<Json>) {
		let value = value.into();
		match self.0.iter_mut().find(|(k, _)| k == key) {
			Some((_, slot)) => *slot = value,
			None => self.0.push((key.to_owned(), value)),
		}
	}

	/// Append every entry of `other`, replacing the ones already present.
	#[must_use]
	pub fn extend(mut self, other: Self) -> Self {
		for (key, value) in other.0 {
			self.set(&key, value);
		}
		self
	}

	pub fn get(&self, key: &str) -> Option<&Json> {
		self.0.iter().find_map(|(k, v)| (k == key).then_some(v))
	}

	pub fn iter(&self) -> impl ExactSizeIterator<Item = (&str, &Json)> {
		self.0.iter().map(|(k, v)| (k.as_str(), v))
	}

	pub fn len(&self) -> usize {
		self.0.len()
	}

	pub fn is_empty(&self) -> bool {
		self.0.is_empty()
	}

	/// Drop `null`, `""` and `[]` values, so an optional fact that is not on
	/// file (no phone yet, no geo) never emits a blank schema field. Shallow —
	/// the TS `ldCompact` is too, and each node compacts itself as it is built.
	#[must_use]
	pub fn compact(self) -> Self {
		Self(
			self.0
				.into_iter()
				.filter(|(_, v)| !matches!(v, Json::Null) && !matches!(v, Json::Str(s) if s.is_empty()) && !matches!(v, Json::List(l) if l.is_empty()))
				.collect(),
		)
	}
}

impl FromIterator<(String, Json)> for Object {
	fn from_iter<I: IntoIterator<Item = (String, Json)>>(iter: I) -> Self {
		let mut out = Self::new();
		for (key, value) in iter {
			out.set(&key, value);
		}
		out
	}
}

impl Json {
	/// Compact JSON, as `JSON.stringify(value)` writes it.
	pub fn to_json(&self) -> String {
		let mut out = String::new();
		self.write(&mut out, None, 0);
		out
	}

	/// Indented JSON, as `JSON.stringify(value, null, 2)` writes it.
	pub fn to_json_pretty(&self) -> String {
		let mut out = String::new();
		self.write(&mut out, Some(2), 0);
		out
	}

	/// Compact JSON safe to inline in a `<script>` element: every `<` is
	/// escaped, so no string value — copy comes from translators and live
	/// sources — can close the element early.
	pub fn to_script(&self) -> String {
		self.to_json().replace('<', "\\u003c")
	}

	pub fn as_object(&self) -> Option<&Object> {
		match self {
			Self::Object(o) => Some(o),
			_ => None,
		}
	}

	fn write(&self, out: &mut String, indent: Option<usize>, depth: usize) {
		match self {
			Self::Null => out.push_str("null"),
			Self::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
			Self::Num(n) => write_number(out, *n),
			Self::Str(s) => write_string(out, s),
			Self::List(items) => {
				if items.is_empty() {
					out.push_str("[]");
					return;
				}
				out.push('[');
				for (i, item) in items.iter().enumerate() {
					if i > 0 {
						out.push(',');
					}
					newline(out, indent, depth + 1);
					item.write(out, indent, depth + 1);
				}
				newline(out, indent, depth);
				out.push(']');
			}
			Self::Object(object) => {
				if object.is_empty() {
					out.push_str("{}");
					return;
				}
				out.push('{');
				for (i, (key, value)) in object.iter().enumerate() {
					if i > 0 {
						out.push(',');
					}
					newline(out, indent, depth + 1);
					write_string(out, key);
					out.push(':');
					if indent.is_some() {
						out.push(' ');
					}
					value.write(out, indent, depth + 1);
				}
				newline(out, indent, depth);
				out.push('}');
			}
		}
	}
}

fn newline(out: &mut String, indent: Option<usize>, depth: usize) {
	if let Some(width) = indent {
		out.push('\n');
		out.extend(std::iter::repeat_n(' ', width * depth));
	}
}

/// JavaScript's number-to-string for the values a page carries: an integral
/// value prints without a fraction (`149`, not `149.0`) and a non-finite one as
/// `null`, as `JSON.stringify` does. Rust's shortest round-trip form matches
/// JavaScript's for every other value short of exponent notation (≥ 1e21 or
/// < 1e-6), which no price, coordinate or rating reaches.
fn write_number(out: &mut String, n: f64) {
	if !n.is_finite() {
		out.push_str("null");
	} else if n.fract() == 0.0 && n.abs() < 9_007_199_254_740_992.0 {
		// Below 2^53 the cast is exact, and it also turns -0 into "0" as JS does.
		out.push_str(&(n as i64).to_string());
	} else {
		out.push_str(&n.to_string());
	}
}

/// `JSON.stringify`'s string escaping: quotes, backslashes and control
/// characters; everything else, non-ASCII included, verbatim.
fn write_string(out: &mut String, s: &str) {
	out.push('"');
	for c in s.chars() {
		match c {
			'"' => out.push_str("\\\""),
			'\\' => out.push_str("\\\\"),
			'\n' => out.push_str("\\n"),
			'\r' => out.push_str("\\r"),
			'\t' => out.push_str("\\t"),
			'\u{08}' => out.push_str("\\b"),
			'\u{0c}' => out.push_str("\\f"),
			c if u32::from(c) < 0x20 => {
				out.push_str(&format!("\\u{:04x}", u32::from(c)));
			}
			c => out.push(c),
		}
	}
	out.push('"');
}

impl From<&str> for Json {
	fn from(value: &str) -> Self {
		Self::Str(value.to_owned())
	}
}

impl From<String> for Json {
	fn from(value: String) -> Self {
		Self::Str(value)
	}
}

impl From<&String> for Json {
	fn from(value: &String) -> Self {
		Self::Str(value.clone())
	}
}

impl From<f64> for Json {
	fn from(value: f64) -> Self {
		Self::Num(value)
	}
}

impl From<u32> for Json {
	fn from(value: u32) -> Self {
		Self::Num(f64::from(value))
	}
}

impl From<bool> for Json {
	fn from(value: bool) -> Self {
		Self::Bool(value)
	}
}

impl From<Object> for Json {
	fn from(value: Object) -> Self {
		Self::Object(value)
	}
}

impl From<Vec<Json>> for Json {
	fn from(value: Vec<Json>) -> Self {
		Self::List(value)
	}
}

impl From<Vec<Object>> for Json {
	fn from(value: Vec<Object>) -> Self {
		Self::List(value.into_iter().map(Json::Object).collect())
	}
}

impl From<Vec<String>> for Json {
	fn from(value: Vec<String>) -> Self {
		Self::List(value.into_iter().map(Json::Str).collect())
	}
}

/// `None` is `null`, which [`Object::compact`] then drops — the Rust spelling
/// of an `undefined` field in the TypeScript builders.
impl<T: Into<Json>> From<Option<T>> for Json {
	fn from(value: Option<T>) -> Self {
		value.map_or(Self::Null, Into::into)
	}
}
