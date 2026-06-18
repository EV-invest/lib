//! Dioxus bindings — the exposure tracker and the in-experiment event hook,
//! mirroring the TS `ExperimentTracker` / `useExperimentEvent`.
//!
//! Exposure and action events are emitted through an **injected** [`ExposureSink`]
//! ([`EventHandler<TrackedEvent>`]); this crate never imports `analytics`, so the
//! consumer wires the sink to whatever capture it uses. The components are
//! renderer-agnostic (no browser-only code), so they render under `dioxus-ssr`
//! for tests; the exposure event fires from a client effect.

use std::collections::BTreeMap;

use dioxus::prelude::*;

use crate::experiments::config::TrackedEvent;

/// The injected sink the tracker reports through. Build it from a Dioxus
/// `EventHandler` in the consuming app and forward each [`TrackedEvent`] to your
/// analytics `capture` — keeping `experiments` free of any analytics dependency.
pub type ExposureSink = EventHandler<TrackedEvent>;

/// Wraps a section's content for one experiment variant: provides the experiment
/// context to descendants and fires `<experiment>_exposed` once on mount through
/// `on_event`. Mirrors the TS `ExperimentTracker`.
///
/// `variant` is resolved by the caller (e.g. from the `ab_<key>` cookie via
/// [`assign_variant`](crate::experiments::assign_variant) on the browser, or the
/// control on the server). `on_event` is optional — omit it to render without
/// reporting (e.g. in a preview).
#[component]
pub fn ExperimentTracker(experiment: String, variant: String, on_event: Option<ExposureSink>, children: Element) -> Element {
	let exp_for_ctx = experiment.clone();
	let var_for_ctx = variant.clone();
	use_context_provider(move || ExperimentCtx {
		experiment: exp_for_ctx,
		variant: var_for_ctx,
		on_event,
	});
	use_effect(move || {
		if let Some(handler) = on_event {
			handler.call(TrackedEvent::exposure(&experiment, &variant));
		}
	});
	rsx! {
		{children}
	}
}
/// Reads the current experiment context as `(experiment, variant)`. Panics if
/// called outside an [`ExperimentTracker`] (mirrors the TS hook's throw).
pub fn use_experiment() -> (String, String) {
	let ctx = use_context::<ExperimentCtx>();
	(ctx.experiment, ctx.variant)
}
/// Returns a `track(action, props)` closure that emits `<experiment>_<action>`
/// with the bucketed `variant` merged in, through the injected sink. Mirrors the
/// TS `useExperimentEvent`. Panics if called outside an [`ExperimentTracker`].
///
/// ```ignore
/// let track = use_experiment_event();
/// // in an event handler:
/// track("cta_clicked", [("cta".into(), "careers".into())].into());
/// ```
pub fn use_experiment_event() -> impl Fn(&str, BTreeMap<String, String>) {
	let ctx = use_context::<ExperimentCtx>();
	move |action: &str, props: BTreeMap<String, String>| {
		if let Some(handler) = ctx.on_event {
			handler.call(TrackedEvent::action(&ctx.experiment, &ctx.variant, action, props));
		}
	}
}
#[derive(Clone)]
struct ExperimentCtx {
	experiment: String,
	variant: String,
	on_event: Option<ExposureSink>,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::experiments::test_util::render;

	#[test]
	fn tracker_provides_context_to_descendants() {
		#[component]
		fn Probe() -> Element {
			let _track = use_experiment_event();
			let (experiment, variant) = use_experiment();
			rsx! {
				span { "{experiment}:{variant}" }
			}
		}
		fn app() -> Element {
			rsx! {
				ExperimentTracker { experiment: "hero".to_string(), variant: "b".to_string(), Probe {} }
			}
		}
		let html = render(app);
		assert!(html.contains("hero:b"), "{html}");
	}

	#[test]
	fn tracker_renders_children() {
		fn app() -> Element {
			rsx! {
				ExperimentTracker { experiment: "team".to_string(), variant: "a".to_string(),
					p { "body" }
				}
			}
		}
		assert!(render(app).contains("body"));
	}
}
