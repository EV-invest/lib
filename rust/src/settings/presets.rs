//! Org-canonical shared variable groups — one place that fixes the names, so
//! `POSTHOG_KEY` vs `POSTHOG_API_KEY` vs `NEXT_PUBLIC_POSTHOG_KEY` drift stops
//! at the source. Mirrors `presets` in `@evinvest/settings` (which additionally
//! ships the `NEXT_PUBLIC_*` client variants — a browser-bundler concern with
//! no Rust equivalent).
//!
//! Each preset is a plain [`settings!`](crate::settings!) struct: load it on
//! its own, next to your app settings.
//!
//! ```
//! use ev_lib::settings::presets::{AppEnv, Posthog};
//!
//! let posthog = Posthog::from_source(|_| None).unwrap(); // both vars optional
//! assert_eq!(posthog.key, None);
//! let app_env = AppEnv::from_source(|_| None).unwrap();
//! assert_eq!(app_env.app_env, "development"); // defaulted
//! ```

crate::settings! {
	/// PostHog capture credentials, canonical names: `POSTHOG_KEY` /
	/// `POSTHOG_HOST`. Both optional — capture is simply off without them. The
	/// project key (`phc_…`) is write-only and ships in frontend bundles
	/// anyway, so it is not `#[secret]`.
	pub struct Posthog {
		/// `POSTHOG_KEY` — the PostHog project API key (`phc_…`).
		#[env("POSTHOG_KEY")]
		key: Option<String>,
		/// `POSTHOG_HOST` — the capture endpoint (e.g. `https://eu.i.posthog.com`).
		#[env("POSTHOG_HOST")]
		host: Option<String>,
	}
}

crate::settings! {
	/// Sentry reporting, canonical name: `SENTRY_DSN`. Optional — monitoring
	/// is off without it. A DSN authorises event *submission* only, so it is
	/// not `#[secret]`.
	pub struct Sentry {
		/// `SENTRY_DSN` — the project DSN.
		#[env("SENTRY_DSN")]
		dsn: Option<String>,
	}
}

crate::settings! {
	/// The deployment environment, canonical name: `APP_ENV`. Defaults to
	/// `development`; the org values in the wild are `development` and
	/// `production` (kept a free string on purpose — constraining it would
	/// break consumers that add a stage).
	pub struct AppEnv {
		/// `APP_ENV` — e.g. `development` / `production`.
		app_env: String = "development",
	}
}
