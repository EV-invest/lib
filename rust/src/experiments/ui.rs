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
/// context to descendants and fires `<experiment>_exposed` through `on_event` on
/// mount and again whenever the tracked `experiment` or `variant` changes (or a
/// sink first appears) — the mirror of the TS `ExperimentTracker` and its
/// exposure-effect deps.
///
/// `variant` is resolved by the caller (e.g. from the `ab_<key>` cookie via
/// [`assign_variant`](crate::experiments::assign_variant) on the browser, or the
/// control on the server). `on_event` is optional — omit it to render without
/// reporting (e.g. in a preview).
#[component]
pub fn ExperimentTracker(
	experiment: String,
	variant: String,
	// Spelled literally, not as `ExposureSink`: the props macro detects handler
	// props syntactically, and only detected ones get repointed in place across
	// re-renders instead of replaced with a fresh instance.
	on_event: Option<EventHandler<TrackedEvent>>,
	children: Element,
) -> Element {
	let next = Tracked {
		experiment,
		variant,
		has_sink: on_event.is_some(),
	};
	let seed = next.clone();
	// Dioxus context is immutable once provided, so the tracker provides handles
	// and keeps them tracking prop updates (the `use_controllable` idiom) — the
	// mirror of the TS provider rebuilding its value from props every render.
	// The sink lives outside the reactive key on purpose: a handler's identity
	// is an implementation artifact that must never drive exposure re-fires, so
	// it is refreshed every render without notifying, while only semantic
	// changes re-fire the exposure effect below.
	let mut ctx = use_context_provider(move || ExperimentCtx {
		tracked: Signal::new(seed),
		sink: CopyValue::new(on_event),
	});
	ctx.sink.set(on_event);
	if *ctx.tracked.peek() != next {
		ctx.tracked.set(next);
	}
	use_effect(move || {
		// Clone out and drop the guard before running arbitrary consumer code.
		let (experiment, variant) = {
			let tracked = ctx.tracked.read();
			(tracked.experiment.clone(), tracked.variant.clone())
		};
		if let Some(handler) = *ctx.sink.peek() {
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
	let tracked = ctx.tracked.read();
	(tracked.experiment.clone(), tracked.variant.clone())
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
		let Some(handler) = *ctx.sink.peek() else { return };
		let (experiment, variant) = {
			let tracked = ctx.tracked.peek();
			(tracked.experiment.clone(), tracked.variant.clone())
		};
		handler.call(TrackedEvent::action(&experiment, &variant, action, props));
	}
}
#[derive(Clone, Copy)]
struct ExperimentCtx {
	tracked: Signal<Tracked>,
	sink: CopyValue<Option<ExposureSink>>,
}
#[derive(Clone, PartialEq)]
struct Tracked {
	experiment: String,
	variant: String,
	has_sink: bool,
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

	#[test]
	fn tracker_tracks_prop_updates() {
		use std::cell::RefCell;
		thread_local! {
			static VARIANT: RefCell<Option<Signal<String>>> = const { RefCell::new(None) };
		}
		#[component]
		fn Probe() -> Element {
			let (experiment, variant) = use_experiment();
			rsx! {
				span { "{experiment}:{variant}" }
			}
		}
		fn app() -> Element {
			let variant = use_signal(|| "a".to_string());
			VARIANT.with(|slot| *slot.borrow_mut() = Some(variant));
			rsx! {
				ExperimentTracker { experiment: "hero".to_string(), variant: variant(), Probe {} }
			}
		}
		let mut dom = VirtualDom::new(app);
		dom.rebuild_in_place();
		assert!(dioxus_ssr::render(&dom).contains("hero:a"));
		let mut variant = VARIANT.with(|slot| slot.borrow().expect("app captured its variant signal"));
		dom.in_runtime(|| variant.set("b".to_string()));
		dom.render_immediate(&mut dioxus::core::NoOpMutations);
		let html = dioxus_ssr::render(&dom);
		assert!(html.contains("hero:b"), "context must track prop updates: {html}");
	}

	#[test]
	fn exposure_refires_on_prop_change() {
		use std::cell::RefCell;
		thread_local! {
			static EVENTS: RefCell<Vec<TrackedEvent>> = const { RefCell::new(Vec::new()) };
			static VARIANT: RefCell<Option<Signal<String>>> = const { RefCell::new(None) };
			static BUMP: RefCell<Option<Signal<u32>>> = const { RefCell::new(None) };
		}
		fn app() -> Element {
			let variant = use_signal(|| "a".to_string());
			VARIANT.with(|slot| *slot.borrow_mut() = Some(variant));
			let bump = use_signal(|| 0u32);
			bump();
			BUMP.with(|slot| *slot.borrow_mut() = Some(bump));
			rsx! {
				ExperimentTracker {
					experiment: "hero".to_string(),
					variant: variant(),
					on_event: move |event: TrackedEvent| EVENTS.with(|events| events.borrow_mut().push(event)),
					span { "x" }
				}
			}
		}
		// Each render_immediate drains queued events, polls tasks, runs pending
		// effects, and flushes dirty scopes — a few passes reach quiescence with
		// no timing dependence (no async executor needed).
		fn settle(dom: &mut VirtualDom) {
			for _ in 0..8 {
				dom.render_immediate(&mut dioxus::core::NoOpMutations);
			}
		}
		let mut dom = VirtualDom::new(app);
		dom.rebuild_in_place();
		settle(&mut dom);
		EVENTS.with(|events| {
			let events = events.borrow();
			assert_eq!(events.len(), 1, "one exposure on mount: {events:?}");
			assert_eq!(events[0].variant, "a");
			assert_eq!(events[0].name, "hero_exposed");
		});
		let mut variant = VARIANT.with(|slot| slot.borrow().expect("app captured its variant signal"));
		dom.in_runtime(|| variant.set("b".to_string()));
		settle(&mut dom);
		EVENTS.with(|events| {
			let events = events.borrow();
			assert_eq!(events.len(), 2, "exposure re-fires on variant change: {events:?}");
			assert_eq!(events[1].variant, "b");
		});
		// A re-render with unchanged tracker props (forced through an unrelated
		// signal) must not re-fire — guards against handler identity churn.
		let mut bump = BUMP.with(|slot| slot.borrow().expect("app captured its bump signal"));
		dom.in_runtime(|| bump += 1);
		settle(&mut dom);
		EVENTS.with(|events| {
			assert_eq!(events.borrow().len(), 2, "no exposure on a re-render with unchanged props: {:?}", events.borrow());
		});
	}

	#[test]
	fn tracker_without_on_event_renders_without_panicking() {
		// `on_event: None` must render the subtree and expose context without firing
		// anything. The exposure effect does not run under dioxus-ssr, so we assert
		// only on rendered output + context wiring (event-name logic is covered by
		// the config.rs `TrackedEvent` tests).
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
				ExperimentTracker { experiment: "hero".to_string(), variant: "a".to_string(), on_event: None,
					Probe {}
					p { "body" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("hero:a"), "{html}");
		assert!(html.contains("body"), "{html}");
	}
}
