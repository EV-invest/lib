//! Browser cookie bucketing (wasm only): read/write the sticky `ab_<key>` cookie
//! and assign a variant via `js_sys::Math::random`. Mirrors the TS
//! `cycle-variant`/`get-variant` cookie handling. The whole module is
//! `target_arch = "wasm32"`-gated by [`super`]; the pure assignment logic lives in
//! [`config`](crate::experiments::config) and is tested there.

use wasm_bindgen::JsCast;

use crate::experiments::config::{Experiment, cookie_name, pick_variant, resolve_variant};

/// Sticky cookie lifetime: 30 days, matching the TS proxy's `max-age`.
const COOKIE_MAX_AGE_SECS: u32 = 60 * 60 * 24 * 30;

/// Reads a cookie value by name from `document.cookie`, or `None` when absent.
pub fn read_cookie(name: &str) -> Option<String> {
	let cookie = html_document()?.cookie().ok()?;
	cookie.split(';').find_map(|pair| {
		let (key, value) = pair.trim().split_once('=')?;
		(key == name).then(|| value.to_string())
	})
}
/// Writes the sticky `ab_<key>` cookie (`path=/`, 30-day `max-age`, `samesite=lax`).
pub fn write_variant(key: &str, value: &str) {
	if let Some(doc) = html_document() {
		let cookie = format!("{}={value}; path=/; max-age={COOKIE_MAX_AGE_SECS}; samesite=lax", cookie_name(key));
		let _ = doc.set_cookie(&cookie);
	}
}
/// Resolves the current variant from the `ab_<key>` cookie, falling back to the
/// control. Does not assign — use [`assign_variant`] for first-visit bucketing.
pub fn current_variant(exp: &Experiment, key: &str) -> String {
	resolve_variant(exp, read_cookie(&cookie_name(key)).as_deref())
}
/// Returns the sticky variant for `key`, assigning (weighted random) and writing
/// the cookie on first visit. Mirrors the TS proxy's per-device bucketing: an
/// existing `ab_<key>` cookie is never re-drawn or rewritten, and a value that is
/// no longer in `exp.variants` resolves to the control — so a visitor whose
/// variant was dropped from the config stays pinned rather than being re-bucketed.
pub fn assign_variant(exp: &Experiment, key: &str) -> String {
	if let Some(existing) = read_cookie(&cookie_name(key)) {
		return resolve_variant(exp, Some(&existing));
	}
	let variant = pick_variant(exp, js_sys::Math::random);
	write_variant(key, &variant);
	variant
}
fn html_document() -> Option<web_sys::HtmlDocument> {
	web_sys::window()?.document()?.dyn_into::<web_sys::HtmlDocument>().ok()
}
