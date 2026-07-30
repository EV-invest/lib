//! Config drift detection — "the environment moved, this process didn't".
//!
//! A running process cannot see its own environment change: `std::env` is fixed
//! at `exec`, and a container runtime that injected the values through `envFrom`
//! never revisits them. Polling [`std::env::var`] is therefore always a no-op —
//! which is why this module takes an **injected source** instead. Point it at
//! whatever actually moves: a Secret mounted as a directory of files, a rendered
//! dotenv file, a control-plane API. Reading that source is the caller's job;
//! `settings` stays I/O-free and dependency-free.
//!
//! The comparison is against **boot** values, not against the previous poll: the
//! interesting fact is "this process is running with settings that no longer
//! match the source", and that stays true until it is redeployed. Expect a
//! detected drift to keep being reported — that is the alert, not a bug.
//!
//! Values are never retained or printed: a variable is stored as a hash, and a
//! change is reported as a name plus a verb. Redeploy is the fix — this module
//! deliberately offers no way to apply a change in place, because a process that
//! reconfigures itself stops matching the git state that is supposed to describe
//! it.
//!
//! ```
//! use ev_lib::settings::drift::{ChangeKind, Snapshot};
//!
//! let vars = ["SMTP_HOST".to_string(), "SENTRY_DSN".to_string()];
//! let at_boot = Snapshot::capture(&vars, &mut |var| match var {
//!     "SMTP_HOST" => Some("smtp.example".to_string()),
//!     _ => None,
//! });
//! // …five minutes later, re-read the same source
//! let now = Snapshot::capture(&vars, &mut |var| match var {
//!     "SMTP_HOST" => Some("smtp.elsewhere".to_string()),
//!     "SENTRY_DSN" => Some("https://key@sentry.example/1".to_string()),
//!     _ => None,
//! });
//!
//! let changes = at_boot.diff(&now);
//! assert_eq!(changes.len(), 2);
//! assert_eq!(changes[0].kind, ChangeKind::Appeared); // SENTRY_DSN — BTreeMap order
//! assert_eq!(changes[1].kind, ChangeKind::Changed); // SMTP_HOST
//! assert_eq!(changes[1].to_string(), "SMTP_HOST: changed since boot");
//! ```

use std::{collections::BTreeMap, fmt};

use super::lookup;

/// What a variable is doing, without saying what it holds.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ChangeKind {
	/// Unset at boot, set now — the "an optional finally got configured" case.
	Appeared,
	/// Set at boot, unset now.
	Disappeared,
	/// Set both times, with a different value.
	Changed,
}

impl fmt::Display for ChangeKind {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		f.write_str(match self {
			ChangeKind::Appeared => "appeared since boot",
			ChangeKind::Disappeared => "disappeared since boot",
			ChangeKind::Changed => "changed since boot",
		})
	}
}

/// One variable that no longer matches what this process booted with.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct VarChange {
	pub var: String,
	pub kind: ChangeKind,
}

impl fmt::Display for VarChange {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		write!(f, "{}: {}", self.var, self.kind)
	}
}

/// The state of a set of variables at one instant: present-or-not, and a hash
/// of the value. Never the value itself — a snapshot of a service's settings is
/// mostly credentials, and this one gets logged.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Snapshot {
	vars: BTreeMap<String, Option<u64>>,
}

impl Snapshot {
	/// Read every named variable from `source`, applying the same
	/// empty-string-is-unset rule as `from_source`. Pair it with the generated
	/// `var_names()` so the watched set cannot drift from the declared one.
	pub fn capture(vars: &[String], source: &mut impl FnMut(&str) -> Option<String>) -> Self {
		Self {
			vars: vars.iter().map(|var| (var.clone(), lookup(source, var).map(|value| fingerprint(&value)))).collect(),
		}
	}

	/// Every variable that differs between the two snapshots, in variable-name
	/// order. Variables only one side knows about are ignored — a changed
	/// *declaration* is a code change, not drift.
	pub fn diff(&self, other: &Self) -> Vec<VarChange> {
		self.vars
			.iter()
			.filter_map(|(var, before)| {
				let after = other.vars.get(var)?;
				let kind = match (before, after) {
					(None, Some(_)) => ChangeKind::Appeared,
					(Some(_), None) => ChangeKind::Disappeared,
					(Some(before), Some(after)) if before != after => ChangeKind::Changed,
					_ => return None,
				};
				Some(VarChange { var: var.clone(), kind })
			})
			.collect()
	}
}

/// A drift check pinned to the values a process booted with.
///
/// Runtime-agnostic on purpose: `settings` carries no async runtime, so the
/// interval belongs to the service that already has one. Five minutes is the
/// house cadence — a kubelet syncs a mounted Secret about once a minute, so
/// anything faster only adds log volume.
///
/// ```no_run
/// # async fn example() {
/// # ev_lib::settings! { pub struct AppSettings { database_url: String } }
/// # fn read_mounted_secret(_var: &str) -> Option<String> { None }
/// # fn interval(_: std::time::Duration) -> Ticker { Ticker }
/// # struct Ticker; impl Ticker { async fn tick(&mut self) {} }
/// let watcher = ev_lib::settings::drift::Watcher::new(AppSettings::var_names(), &mut read_mounted_secret);
/// let mut ticks = interval(std::time::Duration::from_secs(300));
/// loop {
///     ticks.tick().await;
///     for change in watcher.poll(&mut read_mounted_secret) {
///         // your logger of choice — the change never carries a value
///         eprintln!("settings drifted from the source, redeploy to apply: {change}");
///     }
/// }
/// # }
/// ```
#[derive(Clone, Debug)]
pub struct Watcher {
	vars: Vec<String>,
	at_boot: Snapshot,
}

impl Watcher {
	/// Capture the baseline. Call this once, right after the settings load that
	/// the baseline is supposed to describe.
	pub fn new(vars: Vec<String>, source: &mut impl FnMut(&str) -> Option<String>) -> Self {
		let at_boot = Snapshot::capture(&vars, source);
		Self { vars, at_boot }
	}

	/// Re-read the source and report everything that no longer matches boot.
	/// Takes `&self`: the baseline never moves, so a persistent drift keeps
	/// being reported until the process is replaced.
	pub fn poll(&self, source: &mut impl FnMut(&str) -> Option<String>) -> Vec<VarChange> {
		self.at_boot.diff(&Snapshot::capture(&self.vars, source))
	}

	/// The baseline, for a service that wants to diff it against something else.
	pub fn at_boot(&self) -> &Snapshot {
		&self.at_boot
	}
}

/// FNV-1a: enough to notice a changed value, small enough to keep the zero-dep
/// promise. Not a security boundary — it answers "same or not", and a value
/// that never leaves the process cannot be brute-forced out of a log line.
fn fingerprint(value: &str) -> u64 {
	const OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
	const PRIME: u64 = 0x0000_0100_0000_01b3;
	value.bytes().fold(OFFSET, |hash, byte| (hash ^ u64::from(byte)).wrapping_mul(PRIME))
}

#[cfg(test)]
mod tests {
	use super::*;

	fn source(pairs: &[(&str, &str)]) -> impl FnMut(&str) -> Option<String> {
		let pairs: Vec<(String, String)> = pairs.iter().map(|(k, v)| ((*k).to_string(), (*v).to_string())).collect();
		move |var| pairs.iter().find(|(key, _)| key == var).map(|(_, value)| value.clone())
	}

	fn vars() -> Vec<String> {
		vec!["A".to_string(), "B".to_string()]
	}

	#[test]
	fn identical_sources_do_not_drift() {
		let watcher = Watcher::new(vars(), &mut source(&[("A", "1")]));
		assert!(watcher.poll(&mut source(&[("A", "1")])).is_empty());
	}

	#[test]
	fn reports_appeared_disappeared_and_changed() {
		let watcher = Watcher::new(vars(), &mut source(&[("A", "1")]));
		let changes = watcher.poll(&mut source(&[("A", "2"), ("B", "new")]));
		assert_eq!(
			changes,
			vec![
				VarChange {
					var: "A".to_string(),
					kind: ChangeKind::Changed
				},
				VarChange {
					var: "B".to_string(),
					kind: ChangeKind::Appeared
				},
			]
		);

		let changes = watcher.poll(&mut source(&[]));
		assert_eq!(
			changes,
			vec![VarChange {
				var: "A".to_string(),
				kind: ChangeKind::Disappeared
			}]
		);
	}

	#[test]
	fn the_baseline_is_boot_not_the_previous_poll() {
		let watcher = Watcher::new(vars(), &mut source(&[("A", "1")]));
		assert_eq!(watcher.poll(&mut source(&[("A", "2")])).len(), 1);
		// Same drift, polled again: still reported. The process is still stale.
		assert_eq!(watcher.poll(&mut source(&[("A", "2")])).len(), 1);
	}

	#[test]
	fn empty_is_unset_matches_the_parsing_contract() {
		let watcher = Watcher::new(vars(), &mut source(&[("A", "")]));
		assert!(watcher.poll(&mut source(&[])).is_empty(), "`A=` and no `A` are the same state");
	}

	#[test]
	fn snapshots_never_retain_values() {
		let snapshot = Snapshot::capture(&vars(), &mut source(&[("A", "hunter2")]));
		assert!(!format!("{snapshot:?}").contains("hunter2"));
	}

	#[test]
	fn undeclared_variables_are_not_drift() {
		let watcher = Watcher::new(vars(), &mut source(&[("A", "1")]));
		assert!(watcher.poll(&mut source(&[("A", "1"), ("UNDECLARED", "x")])).is_empty());
	}
}
