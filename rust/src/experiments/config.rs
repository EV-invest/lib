//! Framework-agnostic A/B bucketing — the port of the TypeScript
//! `@evinvest/experiments` core. Pure, I/O-free, `wasm32`-safe: variant
//! assignment is deterministic given a random source, so the same helpers drive
//! native tests and the browser (where the source is `js_sys::Math::random`).

use std::collections::BTreeMap;

/// One experiment: an ordered set of `variants` with matching `weights`.
///
/// `variants[0]` is the control — [`resolve_variant`] falls back to it when a
/// cookie is missing or invalid. `weights` are relative (they need not sum to 1);
/// [`pick_variant`] normalises by their total.
///
/// `enabled` and `holdout` mirror the optional TS `ExperimentSpec` fields: `None`
/// means "enabled" and "no holdout", so an experiment built without them behaves
/// exactly as before they existed.
#[derive(Clone, Debug, PartialEq)]
pub struct Experiment {
	/// Variant keys, control first. Stable: these are the dashboard contract.
	pub variants: Vec<String>,
	/// Relative weights, one per variant. Normalised by their sum on assignment.
	pub weights: Vec<f64>,
	/// Kill switch. `Some(false)` makes every helper return the control:
	/// [`pick_variant`] draws nothing and [`resolve_variant`] ignores a stored
	/// cookie. `None` = enabled.
	pub enabled: Option<bool>,
	/// Share in `[0, 1]` of assignments pinned to the control before the weighted
	/// split; out-of-range values are clamped, `NaN` is 0. `None` = no holdout.
	pub holdout: Option<f64>,
}

impl Experiment {
	/// Builds an experiment from explicit variants and relative weights.
	///
	/// # Examples
	/// ```
	/// use ev_lib::experiments::Experiment;
	/// let hero = Experiment::new(["a", "b"], [0.5, 0.5]);
	/// assert_eq!(hero.variants.len(), 2);
	/// ```
	pub fn new(variants: impl IntoIterator<Item = impl Into<String>>, weights: impl IntoIterator<Item = f64>) -> Self {
		Self {
			variants: variants.into_iter().map(Into::into).collect(),
			weights: weights.into_iter().collect(),
			enabled: None,
			holdout: None,
		}
	}

	/// Builds an experiment with equal weight on every variant.
	///
	/// # Examples
	/// ```
	/// use ev_lib::experiments::Experiment;
	/// let team = Experiment::uniform(["a", "b", "c"]);
	/// assert_eq!(team.weights, vec![1.0, 1.0, 1.0]);
	/// ```
	pub fn uniform(variants: impl IntoIterator<Item = impl Into<String>>) -> Self {
		let variants: Vec<String> = variants.into_iter().map(Into::into).collect();
		let weights = vec![1.0; variants.len()];
		Self {
			variants,
			weights,
			enabled: None,
			holdout: None,
		}
	}

	/// Sets the kill switch (see [`Experiment::enabled`]).
	///
	/// # Examples
	/// ```
	/// use ev_lib::experiments::{Experiment, pick_variant};
	/// let off = Experiment::new(["a", "b"], [0.0, 1.0]).with_enabled(false);
	/// assert_eq!(pick_variant(&off, || unreachable!("a disabled experiment draws nothing")), "a");
	/// ```
	#[must_use]
	pub fn with_enabled(mut self, enabled: bool) -> Self {
		self.enabled = Some(enabled);
		self
	}

	/// Sets the holdout share (see [`Experiment::holdout`]).
	///
	/// # Examples
	/// ```
	/// use ev_lib::experiments::{Experiment, pick_variant};
	/// let exp = Experiment::new(["a", "b"], [0.0, 1.0]).with_holdout(0.2);
	/// assert_eq!(pick_variant(&exp, || 0.1), "a"); // inside the holdout → control
	/// assert_eq!(pick_variant(&exp, || 0.5), "b");
	/// ```
	#[must_use]
	pub fn with_holdout(mut self, holdout: f64) -> Self {
		self.holdout = Some(holdout);
		self
	}

	fn is_disabled(&self) -> bool {
		self.enabled == Some(false)
	}

	/// The effective holdout: clamped to `[0, 1]`, `None`/`NaN` → 0 (mirrors the TS `clampUnit`).
	fn holdout_share(&self) -> f64 {
		match self.holdout {
			Some(h) if !h.is_nan() => h.clamp(0.0, 1.0),
			_ => 0.0,
		}
	}
}

/// The cookie name a variant is stored under: `ab_<key>` (mirrors the TS
/// `cookieName`).
///
/// # Examples
/// ```
/// use ev_lib::experiments::cookie_name;
/// assert_eq!(cookie_name("hero"), "ab_hero");
/// ```
pub fn cookie_name(key: &str) -> String {
	format!("ab_{key}")
}

/// Picks a variant by weighted random draw, mirroring the TS `pickVariant`:
/// normalise by the total weight, draw `rng() * total`, walk the cumulative
/// weights, and fall through to the last variant on rounding. `rng` must yield a
/// value in `[0, 1)`; inject a deterministic closure in tests and
/// `js_sys::Math::random` in the browser.
///
/// A disabled experiment returns the control without calling `rng`. Otherwise
/// `rng` is called exactly once: with a holdout of `h`, a draw below `h` returns
/// the control and the rest is rescaled to `(u - h) / (1 - h)` before the
/// weighted walk.
///
/// Returns an empty string only when the experiment has no variants.
///
/// # Examples
/// ```
/// use ev_lib::experiments::Experiment;
/// let exp = Experiment::new(["a", "b"], [0.5, 0.5]);
/// // A draw below the first weight lands on the control.
/// assert_eq!(ev_lib::experiments::pick_variant(&exp, || 0.1), "a");
/// // A draw above it lands on the second variant.
/// assert_eq!(ev_lib::experiments::pick_variant(&exp, || 0.9), "b");
/// ```
pub fn pick_variant(exp: &Experiment, mut rng: impl FnMut() -> f64) -> String {
	let control = || exp.variants.first().cloned().unwrap_or_default();
	if exp.is_disabled() {
		return control();
	}
	let total: f64 = exp.weights.iter().copied().filter(|w| *w > 0.0).sum();
	if total <= 0.0 || exp.variants.is_empty() {
		return control();
	}
	let mut u = rng();
	// Holdout reuses the single draw rather than taking a second one: the bottom
	// `h` of [0, 1) is the holdout, the rest is rescaled back onto [0, 1). With no
	// holdout the draw is untouched, so existing seeded picks keep their result
	// (and stay bit-identical to the TS `pickVariant`).
	let h = exp.holdout_share();
	if h > 0.0 {
		if u < h {
			return control();
		}
		u = (u - h) / (1.0 - h);
	}
	let mut threshold = u * total;
	for (i, weight) in exp.weights.iter().enumerate() {
		threshold -= weight;
		if threshold < 0.0
			&& let Some(v) = exp.variants.get(i)
		{
			return v.clone();
		}
	}
	exp.variants.last().cloned().unwrap_or_default()
}

/// Coerces a raw cookie value to a valid variant, falling back to the control
/// (`variants[0]`) when it is missing or unknown (mirrors the TS
/// `resolveVariant`). A disabled experiment always resolves to the control, so
/// flipping `enabled` off takes effect for visitors who already carry a cookie.
///
/// # Examples
/// ```
/// use ev_lib::experiments::{Experiment, resolve_variant};
/// let exp = Experiment::new(["a", "b"], [0.5, 0.5]);
/// assert_eq!(resolve_variant(&exp, Some("b")), "b");
/// assert_eq!(resolve_variant(&exp, Some("zzz")), "a");
/// assert_eq!(resolve_variant(&exp, None), "a");
/// ```
pub fn resolve_variant(exp: &Experiment, raw: Option<&str>) -> String {
	match raw {
		Some(value) if !exp.is_disabled() && exp.variants.iter().any(|v| v == value) => value.to_string(),
		_ => exp.variants.first().cloned().unwrap_or_default(),
	}
}

/// What sticky cookie assignment should do for one experiment — the pure
/// decision behind the wasm `assign_variant`, kept here so it tests natively.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Assignment {
	/// The experiment is disabled: serve the control and write **no** cookie, so
	/// re-enabling it does not leave visitors pinned to a control recorded
	/// during the pause (mirrors the TS `abProxy` skipping disabled experiments).
	Paused(String),
	/// A cookie is already set: serve its resolved value and leave it alone.
	Sticky(String),
	/// First visit: serve the drawn variant and persist it.
	New(String),
}

impl Assignment {
	/// The variant to serve.
	pub fn variant(&self) -> &str {
		match self {
			Self::Paused(v) | Self::Sticky(v) | Self::New(v) => v,
		}
	}

	/// Whether the variant must be written to the `ab_<key>` cookie.
	pub fn persist(&self) -> bool {
		match self {
			Self::New(_) => true,
			Self::Paused(_) | Self::Sticky(_) => false,
		}
	}
}

/// Decides the sticky assignment given the currently stored cookie value.
/// A disabled experiment is [`Assignment::Paused`] without drawing; an existing
/// cookie is [`Assignment::Sticky`] (an unknown value resolves to the control
/// rather than being re-drawn); otherwise [`pick_variant`] draws a
/// [`Assignment::New`] variant.
///
/// # Examples
/// ```
/// use ev_lib::experiments::{Assignment, Experiment, plan_assignment};
/// let exp = Experiment::new(["a", "b"], [0.0, 1.0]);
/// assert_eq!(plan_assignment(&exp, None, || 0.5), Assignment::New("b".into()));
/// assert_eq!(plan_assignment(&exp, Some("a"), || 0.5), Assignment::Sticky("a".into()));
/// let off = exp.with_enabled(false);
/// assert_eq!(plan_assignment(&off, None, || 0.5), Assignment::Paused("a".into()));
/// ```
pub fn plan_assignment(exp: &Experiment, existing: Option<&str>, rng: impl FnMut() -> f64) -> Assignment {
	if exp.is_disabled() {
		return Assignment::Paused(exp.variants.first().cloned().unwrap_or_default());
	}
	match existing {
		Some(raw) => Assignment::Sticky(resolve_variant(exp, Some(raw))),
		None => Assignment::New(pick_variant(exp, rng)),
	}
}

/// Returns the variant `step` positions from `current`, wrapping around the list
/// (mirrors the TS `nextVariant`, used by the dev cycle). Unknown `current`
/// values start from the control.
///
/// # Examples
/// ```
/// use ev_lib::experiments::{Experiment, next_variant};
/// let exp = Experiment::new(["a", "b", "c"], [1.0, 1.0, 1.0]);
/// assert_eq!(next_variant(&exp, "a", 1), "b");
/// assert_eq!(next_variant(&exp, "c", 1), "a");
/// assert_eq!(next_variant(&exp, "a", -1), "c");
/// ```
pub fn next_variant(exp: &Experiment, current: &str, step: i32) -> String {
	if exp.variants.is_empty() {
		return String::new();
	}
	let len = exp.variants.len() as i32;
	let idx = exp.variants.iter().position(|v| v == current).map(|i| i as i32).unwrap_or(0);
	let next = (((idx + step) % len) + len) % len;
	exp.variants[next as usize].clone()
}

/// The exposure event name for an experiment: `<experiment>_exposed` (mirrors the
/// TS `ExperimentTracker`).
///
/// # Examples
/// ```
/// assert_eq!(ev_lib::experiments::exposed_event("hero"), "hero_exposed");
/// ```
pub fn exposed_event(experiment: &str) -> String {
	format!("{experiment}_exposed")
}

/// The scoped event name for an in-experiment action: `<experiment>_<action>`
/// (mirrors the TS `useExperimentEvent`).
///
/// # Examples
/// ```
/// assert_eq!(ev_lib::experiments::action_event("team", "cta_clicked"), "team_cta_clicked");
/// ```
pub fn action_event(experiment: &str, action: &str) -> String {
	format!("{experiment}_{action}")
}

/// An analytics event emitted by the experiment tracker, handed to the consumer's
/// injected sink. This type is owned by `experiments` so the library never
/// imports `analytics`: a consumer forwards it to whatever capture it uses.
#[derive(Clone, Debug, PartialEq)]
pub struct TrackedEvent {
	/// The event name — [`exposed_event`] or [`action_event`].
	pub name: String,
	/// The variant the user was bucketed into, merged into every event.
	pub variant: String,
	/// Extra, primitive, non-PII properties supplied at the call site.
	pub props: BTreeMap<String, String>,
}

impl TrackedEvent {
	/// Builds an exposure event (`<experiment>_exposed`) for a variant.
	pub fn exposure(experiment: &str, variant: &str) -> Self {
		Self {
			name: exposed_event(experiment),
			variant: variant.to_string(),
			props: BTreeMap::new(),
		}
	}

	/// Builds a scoped action event (`<experiment>_<action>`) for a variant.
	pub fn action(experiment: &str, variant: &str, action: &str, props: BTreeMap<String, String>) -> Self {
		Self {
			name: action_event(experiment, action),
			variant: variant.to_string(),
			props,
		}
	}
}

#[cfg(test)]
mod tests {
	use std::collections::BTreeMap;

	use super::*;

	/// A deterministic rng that yields a fixed value; injected so picks are reproducible.
	fn fixed(v: f64) -> impl FnMut() -> f64 {
		move || v
	}

	#[test]
	fn cookie_name_is_prefixed() {
		assert_eq!(cookie_name("hero"), "ab_hero");
		assert_eq!(cookie_name(""), "ab_");
	}

	#[test]
	fn experiment_new_keeps_variants_and_weights() {
		let exp = Experiment::new(["a", "b"], [0.5, 0.5]);
		assert_eq!(exp.variants, vec!["a".to_string(), "b".to_string()]);
		assert_eq!(exp.weights, vec![0.5, 0.5]);
	}

	#[test]
	fn experiment_new_empty_is_empty() {
		let exp = Experiment::new(Vec::<String>::new(), Vec::<f64>::new());
		assert!(exp.variants.is_empty());
		assert!(exp.weights.is_empty());
	}

	#[test]
	fn experiment_uniform_matches_variant_count() {
		let exp = Experiment::uniform(["a", "b", "c"]);
		assert_eq!(exp.weights, vec![1.0, 1.0, 1.0]);
		assert_eq!(exp.weights.len(), exp.variants.len());
	}

	#[test]
	fn experiment_uniform_empty_has_no_weights() {
		let exp = Experiment::uniform(Vec::<String>::new());
		assert!(exp.variants.is_empty());
		assert!(exp.weights.is_empty());
	}

	#[test]
	fn pick_variant_respects_weight_boundaries() {
		let exp = Experiment::new(["a", "b"], [0.3, 0.7]);
		// draw just under 0.3 of the total → control
		assert_eq!(pick_variant(&exp, fixed(0.0)), "a");
		assert_eq!(pick_variant(&exp, fixed(0.29)), "a");
		// draw above the first weight → second variant
		assert_eq!(pick_variant(&exp, fixed(0.31)), "b");
		assert_eq!(pick_variant(&exp, fixed(0.999)), "b");
	}

	#[test]
	fn pick_variant_at_exact_cumulative_boundary_lands_on_next() {
		// total 1.0, control weight 0.3. r = 0.3 exactly: 0.3 - 0.3 = 0.0, which is
		// NOT < 0, so the boundary belongs to the second variant.
		let exp = Experiment::new(["a", "b"], [0.3, 0.7]);
		assert_eq!(pick_variant(&exp, fixed(0.3)), "b");
		// Just below the boundary stays on the control.
		assert_eq!(pick_variant(&exp, fixed(0.2999)), "a");
	}

	#[test]
	fn pick_variant_rng_one_falls_through_to_last() {
		// rng() -> 1.0 makes threshold == total, so the cumulative walk never trips
		// `< 0`; the fall-through must return the last variant, never "".
		let exp = Experiment::new(["a", "b", "c"], [1.0, 1.0, 1.0]);
		assert_eq!(pick_variant(&exp, fixed(1.0)), "c");
	}

	#[test]
	fn pick_variant_normalises_unnormalised_weights() {
		let exp = Experiment::new(["a", "b", "c"], [1.0, 1.0, 2.0]);
		// total 4: [0,0.25)→a, [0.25,0.5)→b, [0.5,1)→c
		assert_eq!(pick_variant(&exp, fixed(0.1)), "a");
		assert_eq!(pick_variant(&exp, fixed(0.3)), "b");
		assert_eq!(pick_variant(&exp, fixed(0.6)), "c");
	}

	#[test]
	fn pick_variant_maps_each_subinterval_to_its_variant() {
		// Property-style: a handful of rng points across [0,1) land on the variant
		// whose cumulative sub-interval contains them. total 4 → a [0,.5) b [.5,.75) c [.75,1).
		let exp = Experiment::new(["a", "b", "c"], [2.0, 1.0, 1.0]);
		for (r, expected) in [(0.0, "a"), (0.49, "a"), (0.5, "b"), (0.74, "b"), (0.75, "c"), (0.99, "c")] {
			assert_eq!(pick_variant(&exp, fixed(r)), expected, "rng={r}");
		}
	}

	#[test]
	fn pick_variant_single_variant_always_picks_it() {
		let exp = Experiment::new(["only"], [1.0]);
		assert_eq!(pick_variant(&exp, fixed(0.0)), "only");
		assert_eq!(pick_variant(&exp, fixed(0.5)), "only");
		assert_eq!(pick_variant(&exp, fixed(1.0)), "only");
	}

	#[test]
	fn pick_variant_empty_experiment_returns_empty_string() {
		let exp = Experiment::new(Vec::<String>::new(), Vec::<f64>::new());
		assert_eq!(pick_variant(&exp, fixed(0.5)), "");
	}

	#[test]
	fn pick_variant_falls_back_when_no_weight() {
		let exp = Experiment::new(["a", "b"], [0.0, 0.0]);
		assert_eq!(pick_variant(&exp, fixed(0.5)), "a");
	}

	#[test]
	fn pick_variant_zero_total_falls_back_to_control() {
		// Zero total weight must fall back to the control (variants[0]), regardless of rng.
		let exp = Experiment::new(["control", "b", "c"], [0.0, 0.0, 0.0]);
		assert_eq!(pick_variant(&exp, fixed(0.0)), "control");
		assert_eq!(pick_variant(&exp, fixed(0.99)), "control");
	}

	#[test]
	fn pick_variant_negative_weights_are_ignored_in_total() {
		// Negative weights are filtered out of the total; the positive variant wins.
		let exp = Experiment::new(["a", "b"], [-1.0, 1.0]);
		assert_eq!(pick_variant(&exp, fixed(0.5)), "b");
	}

	#[test]
	fn pick_variant_more_variants_than_weights_stays_valid() {
		// Missing weights are treated as 0; must never panic and must return a real variant.
		let exp = Experiment::new(["a", "b", "c"], [1.0]);
		// Only "a" carries weight, so every draw lands on it.
		assert_eq!(pick_variant(&exp, fixed(0.0)), "a");
		assert_eq!(pick_variant(&exp, fixed(0.99)), "a");
		assert!(exp.variants.contains(&pick_variant(&exp, fixed(0.5))));
	}

	#[test]
	fn pick_variant_more_weights_than_variants_stays_valid() {
		// Extra weights have no variant to map to; the walk must not panic and must
		// fall through to a real variant rather than "".
		let exp = Experiment::new(["a"], [1.0, 1.0]);
		assert_eq!(pick_variant(&exp, fixed(0.0)), "a");
		assert_eq!(pick_variant(&exp, fixed(0.9)), "a");
		let exp2 = Experiment::new(["a", "b"], [1.0, 1.0, 1.0]);
		// total 3 → a [0,1/3) b [1/3,2/3); the surplus third weight maps to no variant
		// and falls through to the last real variant.
		assert_eq!(pick_variant(&exp2, fixed(0.1)), "a");
		assert_eq!(pick_variant(&exp2, fixed(0.5)), "b");
		assert_eq!(pick_variant(&exp2, fixed(0.9)), "b");
	}

	/// An rng that fails the test if called: a disabled or zero-weight
	/// experiment must decide without drawing (TS parity: `rng` is not called).
	fn never() -> f64 {
		panic!("rng must not be called")
	}

	#[test]
	fn experiment_defaults_to_enabled_without_holdout() {
		let exp = Experiment::new(["a", "b"], [1.0, 1.0]);
		assert_eq!((exp.enabled, exp.holdout), (None, None));
		let uni = Experiment::uniform(["a", "b"]);
		assert_eq!((uni.enabled, uni.holdout), (None, None));
	}

	#[test]
	fn disabled_experiment_picks_control_without_drawing() {
		let off = Experiment::new(["a", "b"], [0.0, 1.0]).with_enabled(false);
		assert_eq!(pick_variant(&off, never), "a");
	}

	#[test]
	fn zero_total_weight_picks_control_without_drawing() {
		let exp = Experiment::new(["a", "b"], [0.0, -1.0]).with_holdout(0.5);
		assert_eq!(pick_variant(&exp, never), "a");
	}

	#[test]
	fn enabled_true_behaves_like_omitted() {
		let on = Experiment::new(["a", "b"], [0.0, 1.0]).with_enabled(true);
		assert_eq!(pick_variant(&on, fixed(0.5)), "b");
		assert_eq!(resolve_variant(&on, Some("b")), "b");
	}

	#[test]
	fn disabled_experiment_resolves_valid_cookie_to_control() {
		let off = Experiment::new(["a", "b"], [1.0, 1.0]).with_enabled(false);
		assert_eq!(resolve_variant(&off, Some("b")), "a");
		assert_eq!(resolve_variant(&off, None), "a");
	}

	#[test]
	fn rng_is_drawn_exactly_once_with_holdout() {
		let exp = Experiment::new(["a", "b"], [1.0, 1.0]).with_holdout(0.3);
		let mut calls = 0;
		pick_variant(&exp, || {
			calls += 1;
			0.9
		});
		assert_eq!(calls, 1);
	}

	#[test]
	fn holdout_pins_low_draws_and_rescales_the_rest() {
		// h = 0.5, weights 50/50: [0,.5) holdout → a; [.5,.75) → a; [.75,1) → b.
		let exp = Experiment::new(["a", "b"], [0.5, 0.5]).with_holdout(0.5);
		for (r, expected) in [(0.0, "a"), (0.49, "a"), (0.5, "a"), (0.74, "a"), (0.75, "b"), (0.99, "b")] {
			assert_eq!(pick_variant(&exp, fixed(r)), expected, "rng={r}");
		}
	}

	#[test]
	fn holdout_zero_is_bit_identical_to_no_holdout() {
		let plain = Experiment::new(["a", "b", "c"], [1.0, 2.0, 3.0]);
		let zero = plain.clone().with_holdout(0.0);
		let neg = plain.clone().with_holdout(-3.0);
		let nan = plain.clone().with_holdout(f64::NAN);
		for i in 0..100 {
			let r = f64::from(i) / 100.0;
			let expected = pick_variant(&plain, fixed(r));
			for exp in [&zero, &neg, &nan] {
				assert_eq!(pick_variant(exp, fixed(r)), expected, "rng={r} holdout={:?}", exp.holdout);
			}
		}
	}

	#[test]
	fn holdout_is_clamped_to_one() {
		let all = Experiment::new(["a", "b"], [0.0, 1.0]).with_holdout(1.0);
		let over = Experiment::new(["a", "b"], [0.0, 1.0]).with_holdout(7.0);
		for r in [0.0, 0.5, 0.999] {
			assert_eq!(pick_variant(&all, fixed(r)), "a");
			assert_eq!(pick_variant(&over, fixed(r)), "a");
		}
	}

	#[test]
	fn plan_assignment_paused_writes_nothing_and_ignores_cookie() {
		let off = Experiment::new(["a", "b"], [0.0, 1.0]).with_enabled(false);
		for existing in [None, Some("b"), Some("zzz")] {
			let plan = plan_assignment(&off, existing, never);
			assert_eq!(plan, Assignment::Paused("a".to_string()), "existing={existing:?}");
			assert!(!plan.persist());
			assert_eq!(plan.variant(), "a");
		}
	}

	#[test]
	fn plan_assignment_new_visit_draws_and_persists() {
		let exp = Experiment::new(["a", "b"], [0.0, 1.0]);
		let plan = plan_assignment(&exp, None, fixed(0.5));
		assert_eq!(plan, Assignment::New("b".to_string()));
		assert!(plan.persist());
	}

	#[test]
	fn plan_assignment_existing_cookie_is_sticky_without_drawing() {
		let exp = Experiment::new(["a", "b"], [0.0, 1.0]);
		let kept = plan_assignment(&exp, Some("a"), never);
		assert_eq!(kept, Assignment::Sticky("a".to_string()));
		assert!(!kept.persist());
		// A dropped variant resolves to the control, never re-drawn or rewritten.
		assert_eq!(plan_assignment(&exp, Some("gone"), never), Assignment::Sticky("a".to_string()));
	}

	#[test]
	fn plan_assignment_after_re_enable_draws_fresh_for_unpinned_visitors() {
		// A visitor first seen during the pause got no cookie, so once the
		// experiment is back on they are bucketed normally, not stuck on control.
		let exp = Experiment::new(["a", "b"], [0.0, 1.0]);
		let paused = plan_assignment(&exp.clone().with_enabled(false), None, never);
		assert!(!paused.persist());
		assert_eq!(plan_assignment(&exp.with_enabled(true), None, fixed(0.5)), Assignment::New("b".to_string()));
	}

	#[test]
	fn resolve_variant_valid_unknown_none_and_empty() {
		let exp = Experiment::new(["a", "b"], [0.5, 0.5]);
		assert_eq!(resolve_variant(&exp, Some("b")), "b");
		assert_eq!(resolve_variant(&exp, Some("garbage")), "a");
		assert_eq!(resolve_variant(&exp, Some("")), "a");
		assert_eq!(resolve_variant(&exp, None), "a");

		let empty = Experiment::new(Vec::<String>::new(), Vec::<f64>::new());
		assert_eq!(resolve_variant(&empty, Some("anything")), "");
		assert_eq!(resolve_variant(&empty, None), "");
	}

	#[test]
	fn next_variant_wraps_both_directions() {
		let exp = Experiment::new(["a", "b", "c"], [1.0, 1.0, 1.0]);
		assert_eq!(next_variant(&exp, "a", 1), "b");
		assert_eq!(next_variant(&exp, "c", 1), "a");
		assert_eq!(next_variant(&exp, "a", -1), "c");
		assert_eq!(next_variant(&exp, "unknown", 1), "b");
	}

	#[test]
	fn next_variant_step_zero_is_identity() {
		let exp = Experiment::new(["a", "b", "c"], [1.0, 1.0, 1.0]);
		assert_eq!(next_variant(&exp, "b", 0), "b");
		// Unknown current with step 0 falls to the control (index 0).
		assert_eq!(next_variant(&exp, "unknown", 0), "a");
	}

	#[test]
	fn next_variant_large_steps_wrap_via_modulo() {
		let exp = Experiment::new(["a", "b", "c"], [1.0, 1.0, 1.0]);
		// |step| > len: 5 % 3 == 2, so from "a" we land two ahead → "c".
		assert_eq!(next_variant(&exp, "a", 5), "c");
		// Negative big step: from "a" stepping back 5 (== back 2) → "b".
		assert_eq!(next_variant(&exp, "a", -5), "b");
		// Full multiple of len is identity.
		assert_eq!(next_variant(&exp, "b", 6), "b");
		assert_eq!(next_variant(&exp, "b", -6), "b");
	}

	#[test]
	fn next_variant_single_variant_is_always_itself() {
		let exp = Experiment::new(["only"], [1.0]);
		assert_eq!(next_variant(&exp, "only", 1), "only");
		assert_eq!(next_variant(&exp, "only", -1), "only");
		assert_eq!(next_variant(&exp, "unknown", 3), "only");
	}

	#[test]
	fn next_variant_empty_experiment_returns_empty_string() {
		let exp = Experiment::new(Vec::<String>::new(), Vec::<f64>::new());
		assert_eq!(next_variant(&exp, "a", 1), "");
		assert_eq!(next_variant(&exp, "", 0), "");
	}

	#[test]
	fn event_names_match_taxonomy() {
		assert_eq!(exposed_event("hero"), "hero_exposed");
		assert_eq!(action_event("team", "cta_clicked"), "team_cta_clicked");
	}

	#[test]
	fn tracked_event_exposure_carries_name_and_variant() {
		let ev = TrackedEvent::exposure("hero", "a");
		assert_eq!(ev.name, "hero_exposed");
		assert_eq!(ev.variant, "a");
		assert!(ev.props.is_empty());
	}

	#[test]
	fn tracked_event_action_carries_scoped_name_variant_and_props() {
		let mut props = BTreeMap::new();
		props.insert("cta".to_string(), "careers".to_string());
		let ev = TrackedEvent::action("team", "b", "cta_clicked", props.clone());
		assert_eq!(ev.name, "team_cta_clicked");
		assert_eq!(ev.variant, "b");
		assert_eq!(ev.props, props);
	}
}
