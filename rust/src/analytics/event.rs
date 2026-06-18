//! The event model and PostHog payload builder — the framework-agnostic,
//! I/O-free, `wasm32`-safe core shared by the native client and the Dioxus
//! frontend. Mirrors the TS `@evinvest/analytics` capture semantics.

use std::collections::BTreeMap;

use serde::Serialize;
use serde_json::{Value, json};

/// PostHog's default US ingestion host, used when no host is configured (mirrors
/// the TS default).
pub const DEFAULT_HOST: &str = "https://us.i.posthog.com";

/// A single event property value. Restricted to primitives by construction: event
/// properties are a dashboard contract and must never carry PII or nested objects
/// (mirrors the TS "primitives only, never PII" rule).
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(untagged)]
pub enum PropValue {
	/// A boolean flag.
	Bool(bool),
	/// An integer count.
	Int(i64),
	/// A floating-point measure.
	Num(f64),
	/// A short, non-PII string (an enum-like label, not free text).
	Str(String),
}

impl From<bool> for PropValue {
	fn from(v: bool) -> Self {
		PropValue::Bool(v)
	}
}
impl From<i64> for PropValue {
	fn from(v: i64) -> Self {
		PropValue::Int(v)
	}
}
impl From<i32> for PropValue {
	fn from(v: i32) -> Self {
		PropValue::Int(v as i64)
	}
}
impl From<f64> for PropValue {
	fn from(v: f64) -> Self {
		PropValue::Num(v)
	}
}
impl From<&str> for PropValue {
	fn from(v: &str) -> Self {
		PropValue::Str(v.to_string())
	}
}
impl From<String> for PropValue {
	fn from(v: String) -> Self {
		PropValue::Str(v)
	}
}

/// A captured event: a snake_case `<surface>_<thing>_<action>` name plus primitive
/// properties. Build it fluently:
///
/// ```
/// use ev::analytics::Event;
/// let e = Event::new("calculator_submitted").prop("amount", 1000).prop("currency", "usd");
/// assert_eq!(e.name, "calculator_submitted");
/// ```
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Event {
	/// The stable, snake_case event name.
	pub name: String,
	/// Primitive, non-PII properties keyed by name (ordered for stable output).
	pub props: BTreeMap<String, PropValue>,
}

impl Event {
	/// Starts an event with the given name and no properties.
	pub fn new(name: impl Into<String>) -> Self {
		Self {
			name: name.into(),
			props: BTreeMap::new(),
		}
	}

	/// Adds (or overwrites) a property, returning `self` for chaining.
	pub fn prop(mut self, key: impl Into<String>, value: impl Into<PropValue>) -> Self {
		self.props.insert(key.into(), value.into());
		self
	}
}

/// Builds the JSON body for PostHog's `POST /capture/` endpoint: the project
/// `api_key`, the `event` name, the `distinct_id`, and the `properties` (with a
/// `$lib` marker appended). Pure and network-free, so it is unit-tested without a
/// server; the timestamp is left to PostHog's receive time.
///
/// ```
/// use ev::analytics::{Event, capture_body};
/// let body = capture_body("phc_key", "anon-1", &Event::new("hero_cta_clicked"));
/// assert_eq!(body["event"], "hero_cta_clicked");
/// assert_eq!(body["distinct_id"], "anon-1");
/// assert_eq!(body["properties"]["$lib"], "ev-analytics");
/// ```
pub fn capture_body(api_key: &str, distinct_id: &str, event: &Event) -> Value {
	let mut properties = serde_json::Map::new();
	for (key, value) in &event.props {
		properties.insert(key.clone(), serde_json::to_value(value).unwrap_or(Value::Null));
	}
	properties.insert("$lib".to_string(), Value::String("ev-analytics".to_string()));
	json!({
		"api_key": api_key,
		"event": event.name,
		"distinct_id": distinct_id,
		"properties": Value::Object(properties),
	})
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn capture_body_has_posthog_shape() {
		let event = Event::new("hero_cta_clicked").prop("variant", "a").prop("count", 3);
		let body = capture_body("phc_abc", "anon-42", &event);
		assert_eq!(body["api_key"], "phc_abc");
		assert_eq!(body["event"], "hero_cta_clicked");
		assert_eq!(body["distinct_id"], "anon-42");
		assert_eq!(body["properties"]["variant"], "a");
		assert_eq!(body["properties"]["count"], 3);
		assert_eq!(body["properties"]["$lib"], "ev-analytics");
	}

	#[test]
	fn prop_values_serialize_as_primitives() {
		assert_eq!(serde_json::to_value(PropValue::Bool(true)).unwrap(), json!(true));
		assert_eq!(serde_json::to_value(PropValue::Int(7)).unwrap(), json!(7));
		assert_eq!(serde_json::to_value(PropValue::Str("x".into())).unwrap(), json!("x"));
	}

	#[test]
	fn prop_overwrites_by_key() {
		let event = Event::new("e").prop("k", 1).prop("k", 2);
		assert_eq!(event.props.get("k"), Some(&PropValue::Int(2)));
	}
}
