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
///
/// Bounded: past [`RateLimiter::MAX_KEYS`] live addresses, every new one
/// shares a single overflow window. A spray of forged addresses then throttles
/// itself instead of growing the map without limit, and the addresses already
/// tracked keep their own windows.
#[derive(Clone, Debug)]
pub struct RateLimiter {
	limit: u32,
	window_ms: i64,
	hits: HashMap<String, Window>,
	overflow: Window,
	pruned_at: Option<i64>,
}

#[derive(Clone, Copy, Debug)]
struct Window {
	start: i64,
	count: u32,
}

impl Window {
	/// Count one hit, restarting the window once it has run out.
	fn hit(&mut self, now_ms: i64, window_ms: i64, limit: u32) -> bool {
		if now_ms - self.start >= window_ms {
			*self = Self { start: now_ms, count: 0 };
		}
		self.count = self.count.saturating_add(1);
		self.count <= limit
	}
}

impl RateLimiter {
	/// Distinct addresses tracked before new ones share the overflow window.
	pub const MAX_KEYS: usize = 10_000;
	/// Expired windows are swept at most this often; a hit on an expired one
	/// restarts it anyway, so sweeping is only about memory.
	const PRUNE_EVERY_MS: i64 = 1_000;

	pub fn new(limit: u32, window_ms: i64) -> Self {
		Self {
			limit,
			window_ms,
			hits: HashMap::new(),
			overflow: Window { start: i64::MIN / 2, count: 0 },
			pruned_at: None,
		}
	}

	/// `true` if this hit is allowed.
	pub fn hit(&mut self, key: &str, now_ms: i64) -> bool {
		if self.pruned_at.is_none_or(|at| now_ms - at >= Self::PRUNE_EVERY_MS) {
			self.hits.retain(|_, w| now_ms - w.start < self.window_ms);
			self.pruned_at = Some(now_ms);
		}
		let (window_ms, limit) = (self.window_ms, self.limit);
		if let Some(window) = self.hits.get_mut(key) {
			return window.hit(now_ms, window_ms, limit);
		}
		if self.hits.len() >= Self::MAX_KEYS {
			return self.overflow.hit(now_ms, window_ms, limit);
		}
		let mut window = Window { start: now_ms, count: 0 };
		let allowed = window.hit(now_ms, window_ms, limit);
		self.hits.insert(key.to_owned(), window);
		allowed
	}

	/// Addresses with a window of their own right now.
	pub fn tracked(&self) -> usize {
		self.hits.len()
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

/// The barriers in order: honeypot, rate limit, timing.
///
/// Every submission that gets past the honeypot spends the limit, whatever its
/// render stamp says. The stamp comes from the client, so a bot that leaves it
/// out must not thereby skip the limiter: a `too-fast` lead is still stored
/// and notified (flagged), and only the limit stops a flood of them. The
/// limit is also checked before the stamp so that a flooding key reads as
/// `rate-limited`, the verdict that is not notified.
pub fn screen(submission: Submission<'_>, limiter: &mut RateLimiter) -> Option<SpamVerdict> {
	if submission.honeypot.is_some_and(|h| !h.trim().is_empty()) {
		return Some(SpamVerdict::Honeypot);
	}
	if !limiter.hit(submission.client_key, submission.now_ms) {
		return Some(SpamVerdict::RateLimited);
	}
	check_timing(submission.rendered_at, submission.now_ms)
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
	fn expired_windows_restart_and_are_swept() {
		let mut limiter = RateLimiter::new(1, 1_000);
		assert!(limiter.hit("a", 0));
		assert!(limiter.hit("b", 500));
		assert!(!limiter.hit("a", 999));
		// The sweep at 1 400 drops the spent window of "a"; a new one starts.
		assert!(limiter.hit("a", 1_400));
		assert_eq!(limiter.tracked(), 2);
		// No sweep yet at 2 000; the next one, a second after the last, drops
		// the spent windows of "a" and "b".
		assert!(limiter.hit("c", 2_000));
		assert_eq!(limiter.tracked(), 3);
		assert!(limiter.hit("d", 2_400));
		assert_eq!(limiter.tracked(), 2);
	}

	#[test]
	fn past_the_key_cap_new_addresses_share_one_window() {
		let mut limiter = RateLimiter::new(2, 60_000);
		for i in 0..RateLimiter::MAX_KEYS {
			assert!(limiter.hit(&format!("10.0.{i}"), 0));
		}
		assert!(limiter.hit("spray-1", 1));
		assert!(limiter.hit("spray-2", 2));
		assert!(!limiter.hit("spray-3", 3));
		assert_eq!(limiter.tracked(), RateLimiter::MAX_KEYS);
		// A tracked address keeps its own window.
		assert!(limiter.hit("10.0.0", 4));
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

	#[test]
	fn a_missing_stamp_does_not_skip_the_limit() {
		const LIMIT: u32 = 3;
		let mut limiter = RateLimiter::new(LIMIT, 60_000);
		let unstamped = Submission {
			honeypot: None,
			rendered_at: None,
			client_key: "bot",
			now_ms: NOW,
		};
		for _ in 0..LIMIT {
			assert_eq!(screen(unstamped, &mut limiter), Some(SpamVerdict::TooFast));
		}
		assert_eq!(screen(unstamped, &mut limiter), Some(SpamVerdict::RateLimited));
	}
}
