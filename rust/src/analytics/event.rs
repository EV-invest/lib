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
/// use ev_lib::analytics::Event;
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
/// use ev_lib::analytics::{Event, capture_body};
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
	fn capture_body_with_no_props_still_carries_lib_marker() {
		let body = capture_body("phc_abc", "anon-1", &Event::new("app_booted"));
		let props = body["properties"].as_object().unwrap();
		assert_eq!(props.len(), 1);
		assert_eq!(props["$lib"], "ev-analytics");
	}

	#[test]
	fn capture_body_serializes_every_prop_value_variant() {
		let event = Event::new("e").prop("flag", true).prop("count", 7_i64).prop("ratio", 1.5_f64).prop("label", "tier_a");
		let body = capture_body("k", "d", &event);
		assert_eq!(body["properties"]["flag"], json!(true));
		assert_eq!(body["properties"]["count"], json!(7));
		assert_eq!(body["properties"]["ratio"], json!(1.5));
		assert_eq!(body["properties"]["label"], json!("tier_a"));
	}

	#[test]
	fn capture_body_props_are_btreemap_sorted() {
		let event = Event::new("e").prop("zebra", 1).prop("alpha", 2).prop("mango", 3);
		let body = capture_body("k", "d", &event);
		let keys: Vec<&String> = body["properties"].as_object().unwrap().keys().collect();
		// BTreeMap sorts user keys; "$lib" is inserted last but '$' < letters so it sorts first.
		assert_eq!(keys, vec!["$lib", "alpha", "mango", "zebra"]);
	}

	#[test]
	fn capture_body_escapes_special_characters_in_name_and_values() {
		let event = Event::new("weird\"name\n\t").prop("k", "a\"b\\c\nd");
		let body = capture_body("key", r#"id"with\quotes"#, &event);
		// serde escapes control/quote chars; round-tripping the rendered JSON must
		// recover the exact originals (proves correct escaping, not corruption).
		let rendered = serde_json::to_string(&body).unwrap();
		let parsed: Value = serde_json::from_str(&rendered).unwrap();
		assert_eq!(parsed["event"], "weird\"name\n\t");
		assert_eq!(parsed["distinct_id"], r#"id"with\quotes"#);
		assert_eq!(parsed["properties"]["k"], "a\"b\\c\nd");
	}

	#[test]
	fn capture_body_user_key_named_lib_is_clobbered_by_marker() {
		// Documented behavior: the "$lib" marker is inserted last and overwrites any
		// user property of the same name. Keep — "$lib" is a reserved PostHog key.
		let event = Event::new("e").prop("$lib", "user-supplied");
		let body = capture_body("k", "d", &event);
		assert_eq!(body["properties"]["$lib"], "ev-analytics");
	}

	#[test]
	fn capture_body_non_finite_f64_becomes_null() {
		// serde_json cannot represent NaN/Inf, so `to_value` errors and the
		// `unwrap_or(Value::Null)` fallback turns the property into JSON null. This
		// keeps the body serializable (PostHog rejects bare NaN) rather than
		// panicking or producing invalid JSON. Documenting, not asserting it is ideal.
		let event = Event::new("e")
			.prop("nan", f64::NAN)
			.prop("inf", f64::INFINITY)
			.prop("neg_inf", f64::NEG_INFINITY)
			.prop("ok", 2.0_f64);
		let body = capture_body("k", "d", &event);
		assert_eq!(body["properties"]["nan"], Value::Null);
		assert_eq!(body["properties"]["inf"], Value::Null);
		assert_eq!(body["properties"]["neg_inf"], Value::Null);
		assert_eq!(body["properties"]["ok"], json!(2.0));
		// The whole body must still serialize to valid JSON.
		assert!(serde_json::to_string(&body).is_ok());
	}

	#[test]
	fn prop_values_serialize_as_primitives() {
		assert_eq!(serde_json::to_value(PropValue::Bool(true)).unwrap(), json!(true));
		assert_eq!(serde_json::to_value(PropValue::Int(7)).unwrap(), json!(7));
		assert_eq!(serde_json::to_value(PropValue::Num(1.5)).unwrap(), json!(1.5));
		assert_eq!(serde_json::to_value(PropValue::Str("x".into())).unwrap(), json!("x"));
	}

	#[test]
	fn prop_value_from_impls_pick_the_right_variant() {
		assert_eq!(PropValue::from(true), PropValue::Bool(true));
		assert_eq!(PropValue::from(9_i64), PropValue::Int(9));
		assert_eq!(PropValue::from(9_i32), PropValue::Int(9));
		assert_eq!(PropValue::from(-3_i32), PropValue::Int(-3));
		assert_eq!(PropValue::from(2.5_f64), PropValue::Num(2.5));
		assert_eq!(PropValue::from("s"), PropValue::Str("s".to_string()));
		assert_eq!(PropValue::from(String::from("s")), PropValue::Str("s".to_string()));
	}

	#[test]
	fn event_new_and_prop_chaining() {
		let event = Event::new("calculator_submitted").prop("amount", 1000).prop("currency", "usd");
		assert_eq!(event.name, "calculator_submitted");
		assert_eq!(event.props.len(), 2);
		assert_eq!(event.props.get("amount"), Some(&PropValue::Int(1000)));
		assert_eq!(event.props.get("currency"), Some(&PropValue::Str("usd".to_string())));
	}

	#[test]
	fn event_default_is_empty() {
		let event = Event::default();
		assert_eq!(event.name, "");
		assert!(event.props.is_empty());
	}

	#[test]
	fn prop_overwrites_by_key() {
		let event = Event::new("e").prop("k", 1).prop("k", 2);
		assert_eq!(event.props.get("k"), Some(&PropValue::Int(2)));
		assert_eq!(event.props.len(), 1);
	}

	#[test]
	fn prop_overwrite_can_change_value_type() {
		let event = Event::new("e").prop("k", 1_i64).prop("k", "now-a-string");
		assert_eq!(event.props.get("k"), Some(&PropValue::Str("now-a-string".to_string())));
	}
}
