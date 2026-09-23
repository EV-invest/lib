//! Three cheap barriers against form spam, none of which needs the visitor to
//! run a script — the quote form has to work before any JavaScript arrives, so
//! a challenge widget is not an option. A rejected submission is answered
//! exactly like an accepted one, so a bot learns nothing from the response.
//!
//! Times are milliseconds since the Unix epoch: the render stamp the form
//! carries is one, written by the page.

use std::collections::HashMap;

/// The field a human never sees and a form-filling bot fills.
pub const HONEYPOT_FIELD: &str = "website";
/// When the form was rendered, in ms since the epoch.
pub const RENDERED_AT_FIELD: &str = "t";
/// Faster than this from render to submit is a script, not a person.
pub const MIN_FILL_MS: i64 = 3_000;
/// A render time this far ahead of the clock was forged.
const MAX_SKEW_MS: i64 = 60_000;

/// Why a submission is suspected. It is still stored, flagged — see the TS
/// `acceptLead` for what each verdict costs.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum SpamVerdict {
	Honeypot,
	TooFast,
	RateLimited,
}

impl SpamVerdict {
	/// The stored value: `"honeypot"`, `"too-fast"`, `"rate-limited"`.
	pub fn as_str(self) -> &'static str {
		match self {
			Self::Honeypot => "honeypot",
			Self::TooFast => "too-fast",
			Self::RateLimited => "rate-limited",
		}
	}
}

/// `None` when the render stamp is plausible. A missing, unparsable or
/// future-forged stamp reads as too fast.
pub fn check_timing(rendered_at: Option<&str>, now_ms: i64) -> Option<SpamVerdict> {
	let stamp = rendered_at.map(str::trim).filter(|s| !s.is_empty()).and_then(|s| s.parse::<f64>().ok()).filter(|t| t.is_finite());
	let Some(t) = stamp else {
		return Some(SpamVerdict::TooFast);
	};
	// Epoch milliseconds stay far below 2^53, where f64 is exact.
	let now = now_ms as f64;
	if t - now > MAX_SKEW_MS as f64 || now - t < MIN_FILL_MS as f64 {
		return Some(SpamVerdict::TooFast);
	}
	None
}

/// A fixed-window counter per client address, in memory. Per process by
/// design: a speed bump for one bot hammering one pod, not an accounting
/// system, and a restart forgetting it costs nothing.
#[derive(Clone, Debug)]
pub struct RateLimiter {
	limit: u32,
	window_ms: i64,
	hits: HashMap<String, Window>,
}

#[derive(Clone, Copy, Debug)]
struct Window {
	start: i64,
	count: u32,
}

impl RateLimiter {
	pub fn new(limit: u32, window_ms: i64) -> Self {
		Self {
			limit,
			window_ms,
			hits: HashMap::new(),
		}
	}

	/// `true` if this hit is allowed.
	pub fn hit(&mut self, key: &str, now_ms: i64) -> bool {
		// Linear in the live keys, fine at a landing page's volume, and it keeps
		// the map from outgrowing one window of distinct addresses.
		self.hits.retain(|_, w| now_ms - w.start < self.window_ms);
		match self.hits.get_mut(key) {
			Some(window) => {
				window.count = window.count.saturating_add(1);
				window.count <= self.limit
			}
			None => {
				self.hits.insert(key.to_owned(), Window { start: now_ms, count: 1 });
				true
			}
		}
	}
}

/// What one submission brings to [`screen`].
#[derive(Clone, Copy, Debug)]
pub struct Submission<'a> {
	pub honeypot: Option<&'a str>,
	pub rendered_at: Option<&'a str>,
	pub client_key: &'a str,
	pub now_ms: i64,
}

/// The barriers in order: honeypot, timing, then the rate limit — so a bot the
/// first two catch does not spend a real visitor's share of the limit.
pub fn screen(submission: Submission<'_>, limiter: &mut RateLimiter) -> Option<SpamVerdict> {
	if submission.honeypot.is_some_and(|h| !h.trim().is_empty()) {
		return Some(SpamVerdict::Honeypot);
	}
	if let Some(verdict) = check_timing(submission.rendered_at, submission.now_ms) {
		return Some(verdict);
	}
	(!limiter.hit(submission.client_key, submission.now_ms)).then_some(SpamVerdict::RateLimited)
}

#[cfg(test)]
mod tests {
	use super::{MIN_FILL_MS, RateLimiter, SpamVerdict, Submission, check_timing, screen};

	const NOW: i64 = 1_790_000_000_000;

	#[test]
	fn a_stamp_must_be_present_plausible_and_old_enough() {
		let stamp = |ms: i64| ms.to_string();
		assert_eq!(check_timing(None, NOW), Some(SpamVerdict::TooFast));
		assert_eq!(check_timing(Some("  "), NOW), Some(SpamVerdict::TooFast));
		assert_eq!(check_timing(Some("soon"), NOW), Some(SpamVerdict::TooFast));
		assert_eq!(check_timing(Some(&stamp(NOW - MIN_FILL_MS + 1)), NOW), Some(SpamVerdict::TooFast));
		assert_eq!(check_timing(Some(&stamp(NOW - MIN_FILL_MS)), NOW), None);
		assert_eq!(check_timing(Some(&stamp(NOW + 60_001)), NOW), Some(SpamVerdict::TooFast));
	}

	#[test]
	fn the_limit_is_per_key_and_per_window() {
		let mut limiter = RateLimiter::new(2, 1_000);
		assert!(limiter.hit("a", 0));
		assert!(limiter.hit("a", 10));
		assert!(!limiter.hit("a", 20));
		assert!(limiter.hit("b", 20));
		assert!(limiter.hit("a", 1_000));
	}

	#[test]
	fn the_honeypot_wins_and_a_caught_bot_spends_no_limit() {
		let mut limiter = RateLimiter::new(1, 60_000);
		let old = (NOW - 10_000).to_string();
		let submission = |honeypot| Submission {
			honeypot,
			rendered_at: Some(&old),
			client_key: "ip",
			now_ms: NOW,
		};
		assert_eq!(screen(submission(Some("spam.example")), &mut limiter), Some(SpamVerdict::Honeypot));
		assert_eq!(screen(submission(None), &mut limiter), None);
		assert_eq!(screen(submission(Some(" ")), &mut limiter), Some(SpamVerdict::RateLimited));
	}
}
