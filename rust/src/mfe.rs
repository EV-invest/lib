//! Producer SDK for landing-host microfrontends.
//!
//! A microfrontend producer ships a self-registering ESM bundle: it defines a
//! custom element (`customElements.define("mfe-…", …)`) whose `connectedCallback`
//! mounts a Dioxus app into the host node (light DOM). The landing host curates a
//! registry of `{name, tag, kind}` and decides where to render each `<tag>`.
//!
//! This module is the entire Rust side of that contract. A producer crate writes
//! ~5 lines via [`mfe!`] and gets: the custom-element registration, the origin
//! self-derivation (so the bundle works cross-origin with no baked env), the
//! server-fn base override, the `{name,tag,kind}` manifest, and the host's
//! locale resolved into a [`Translator`](crate::i18n::Translator) above its root
//! — none of which it can get wrong, because the macro owns the naming
//! convention, the JSON shape, and where a locale comes from.
//!
//! wasm-only (see the `cfg` in `lib.rs`): the one cross-origin bundle is always a
//! `wasm32-unknown-unknown` cdylib. manganis/`dx` are unusable here — their asset
//! URLs are root-relative to the *serving* origin, i.e. inherently same-origin —
//! so producers hand-roll `wasm-bindgen --target web` and this SDK stays
//! manganis-free, deriving every URL from the bundle's own origin instead.

use dioxus::prelude::Element;
use wasm_bindgen::prelude::*;

use crate::i18n::{DEFAULT_LOCALE, LOCALES, Locale, negotiate};

// The only JavaScript in the whole stack — the two things Rust can't express:
// subclassing `HTMLElement` (custom elements must extend it), and reading
// `import.meta.url` (a module-syntax form, not a value any Rust binding sees).
//
// `connectedCallback` fires on every (re)attachment, so it is guarded to mount
// once per element instance: a host router that detaches and re-inserts the node
// would otherwise stack a second live app on the first one's DOM. There is no
// paired `disconnectedCallback` because dioxus-web 0.7 exposes no teardown handle
// (`run() -> !` inside a bare `spawn_local`); the app therefore stays alive across
// a detach and is reused — with its DOM and its delegated listeners intact — when
// the element is re-inserted.
#[wasm_bindgen(inline_js = r#"
export function __ev_register(tag, mount){
  if (customElements.get(tag)) return;
  customElements.define(tag, class extends HTMLElement {
    connectedCallback(){
      if (this.__evMounted) return;
      this.__evMounted = true;
      mount(this);
    }
  });
}
export function __ev_origin(){ return new URL(import.meta.url).origin; }
"#)]
extern "C" {
	#[wasm_bindgen(js_name = __ev_register)]
	fn js_register(tag: &str, mount: &js_sys::Function);
	#[wasm_bindgen(js_name = __ev_origin)]
	fn js_origin() -> String;
}

/// The bundle's own origin, from `import.meta.url`. Drives every URL the bundle
/// emits (server-fn base, stylesheet, seed images) so nothing is baked at build
/// time and the same artifact works behind any host origin.
pub fn bundle_origin() -> String {
	js_origin()
}

/// Define `tag` as a custom element that calls `mount(element)` on its first
/// connect. Idempotent twice over: a no-op if `tag` is already registered, and
/// `mount` runs at most once per element instance, so re-attaching an element
/// (as an SPA host router does on navigate-back) reuses the running app instead
/// of stacking a second one. The `mount` closure must outlive the page — the
/// caller `forget`s it.
pub fn register(tag: &str, mount: &Closure<dyn Fn(web_sys::Element)>) {
	js_register(tag, mount.as_ref().unchecked_ref());
}

/// Launch a Dioxus app rooted at `el` (the custom element instance). Light DOM —
/// the host's fonts/tokens/preflight cascade in, so the bundle must not re-ship them.
pub fn launch_into(el: web_sys::Element, root: fn() -> Element) {
	dioxus::LaunchBuilder::new().with_cfg(dioxus::web::Config::new().rootelement(el)).launch(root);
}

/// The language the host page is written in, read off the DOM `el` is mounted
/// into. The Rust mirror of `localeOfElement` in `@evinvest/i18n`.
///
/// Read from the DOM rather than taken as an attribute or a prop, because a host
/// mounts the element *before* it applies attributes — React's `RemoteElement`
/// appends the node in one effect and sets its attributes in a later one — so
/// anything pushed in reads as absent at `connectedCallback` time. `lang` is the
/// platform's own answer to "what language is this subtree", every host that
/// serves more than one already sets it, and it is readable the instant the node
/// is attached.
///
/// A regional tag resolves to its base language (`ru-RU` → `ru`); an absent or
/// unpublished `lang` reads as [`DEFAULT_LOCALE`].
pub fn host_locale(el: &web_sys::Element) -> Locale {
	el.closest("[lang]")
		.expect("\"[lang]\" is a valid selector")
		.and_then(|scope| scope.get_attribute("lang"))
		.map_or(DEFAULT_LOCALE, |lang| negotiate(Some(&lang), &LOCALES))
}

/// Define a microfrontend producer bundle. Expands in the producer crate (so its
/// `dioxus` rsx, `wasm-bindgen`, and `web-sys` resolve there), generating the
/// custom-element registration, the `wasm-bindgen(start)` entrypoint, and the
/// `MFE_MANIFEST` the build emits as `mfe.json`.
///
/// ```ignore
/// ev_lib::mfe! {
///     service: "real-estate", name: "overview", kind: component,
///     root: real_estate_allocation::embed::Overview, stylesheet: "mfe.css",
///     messages: crate::catalogue
/// }
/// ```
///
/// Naming is enforced: the tag is `mfe-{service}-{name}` and the registry name is
/// `{service}.{name}` — the host can't drift from the producer's identity. One
/// invocation per crate (it owns the single `wasm-bindgen(start)`).
///
/// `messages` is a `fn(Locale) -> Messages` and is **required**, not optional. A
/// producer with no copy passes an empty catalogue as one deliberate, reviewable
/// line; a producer *with* copy cannot forget to resolve its locale, which is
/// the bug the requirement exists to prevent. The macro resolves
/// [`host_locale`](crate::mfe::host_locale) at mount and provides a
/// [`Translator`](crate::i18n::Translator) as Dioxus context above the root, so
/// every component below reaches it with `use_context`.
#[macro_export]
macro_rules! mfe {
	(service: $service:literal,name: $name:literal,kind: $kind:ident,root: $root:path,stylesheet: $stylesheet:literal,messages: $messages:path $(,)?) => {
		const __EV_TAG: &str = concat!("mfe-", $service, "-", $name);

		/// The `{name, tag, kind}` registry contract, emitted by the build as
		/// `mfe.json`. Single source of truth for the host registry entry.
		pub const MFE_MANIFEST: &str = concat!(
			"{\"name\":\"",
			$service,
			".",
			$name,
			"\",\"tag\":\"mfe-",
			$service,
			"-",
			$name,
			"\",\"kind\":\"",
			stringify!($kind),
			"\"}"
		);

		// `launch_into` takes a bare `fn() -> Element`, which has nowhere to carry
		// the resolved locale, so it crosses from the mount into the root here.
		// Macro-internal; a producer never sees it.
		thread_local! {
			static __EV_LOCALE: ::std::cell::Cell<$crate::i18n::Locale> = const {
				::std::cell::Cell::new($crate::i18n::DEFAULT_LOCALE)
			};
		}

		fn __ev_root() -> ::dioxus::prelude::Element {
			use ::dioxus::prelude::*;
			// Alias the root via native `use` so the `$root:path` fragment never
			// enters the rsx proc-macro (captured fragments are opaque to it).
			// PascalCase so rsx reads it as a component, not an HTML element.
			use $root as EvMfeRoot;
			let locale = __EV_LOCALE.with(::std::cell::Cell::get);
			use_context_provider(|| $crate::i18n::Translator::new($messages(locale), locale));
			rsx! {
				document::Stylesheet { href: format!("{}/mfe/{}", $crate::mfe::bundle_origin(), $stylesheet) }
				EvMfeRoot {}
			}
		}

		fn __ev_mount(el: ::web_sys::Element) {
			__EV_LOCALE.set($crate::mfe::host_locale(&el));
			$crate::mfe::launch_into(el, __ev_root);
		}

		#[::wasm_bindgen::prelude::wasm_bindgen(start)]
		pub fn __ev_start() {
			let closure = ::wasm_bindgen::closure::Closure::<dyn Fn(::web_sys::Element)>::new(__ev_mount);
			$crate::mfe::register(__EV_TAG, &closure);
			// The element can mount at any time after registration; the closure must
			// outlive this fn, so hand it to the JS runtime permanently.
			closure.forget();
		}
	};
}
