//! Config drift detection — "the Secret moved, this process didn't". Reached
//! only through the `watch_drift()` that `settings!` generates under the
//! `settings_drift` feature; see the [GUIDE](./GUIDE.md#detecting-drift).
//!
//! A running process cannot see its own environment change (`std::env` is fixed
//! at `exec`), so the watch reads what does move: the k8s Secret mounted as one
//! file per key at `$SETTINGS_DRIFT_MOUNT`. The baseline is that mount when the
//! watch starts — not the process env, which also carries plain `env:` vars that
//! the Secret never holds.
//!
//! The comparison is against **boot**, not the previous poll: "this process runs
//! with settings that no longer match the source" stays true until a redeploy,
//! so a drift keeps being reported. Values are never retained or printed: a
//! variable is stored as a hash, and a change is a name plus a verb.

use std::{collections::BTreeMap, convert::Infallible, fmt, io, path::PathBuf, time::Duration};

use super::lookup;

const MOUNT_VAR: &str = "SETTINGS_DRIFT_MOUNT";
/// A kubelet syncs a mounted Secret about once a minute; faster only adds log volume.
const INTERVAL: Duration = Duration::from_secs(300);

/// Idles forever when `MOUNT_VAR` is unset or not a directory, so the same
/// binary runs unchanged on a laptop and never ends the `select!` it sits in.
pub async fn watch(vars: Vec<String>) -> Infallible {
	let Some(dir) = lookup(&mut |var| std::env::var(var).ok(), MOUNT_VAR).map(PathBuf::from) else {
		return std::future::pending().await;
	};
	if !dir.is_dir() {
		tracing::warn!(mount = %dir.display(), "{MOUNT_VAR} does not point at a directory — config drift watch is off");
		return std::future::pending().await;
	}
	let mut mounted = |var: &str| match std::fs::read_to_string(dir.join(var)) {
		Ok(value) => Some(value),
		Err(e) if e.kind() == io::ErrorKind::NotFound => None, // a key the Secret doesn't carry
		Err(e) => panic!("reading {var} from the mounted Secret at {}: {e}", dir.display()),
	};
	let at_boot = Snapshot::capture(&vars, &mut mounted);
	//LOOP: lives as long as the process it is selected against
	loop {
		tokio::time::sleep(INTERVAL).await;
		for change in at_boot.diff(&Snapshot::capture(&vars, &mut mounted)) {
			tracing::warn!(%change, "settings drifted from the mounted secret — redeploy to apply");
		}
	}
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ChangeKind {
	Appeared,
	Disappeared,
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

#[derive(Clone, Debug, Eq, PartialEq)]
struct VarChange {
	var: String,
	kind: ChangeKind,
}

impl fmt::Display for VarChange {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		write!(f, "{}: {}", self.var, self.kind)
	}
}

/// Present-or-not plus a hash of each value, never the value: a snapshot is
/// mostly credentials, and this one gets logged.
#[derive(Clone, Debug, Eq, PartialEq)]
struct Snapshot {
	vars: BTreeMap<String, Option<u64>>,
}

impl Snapshot {
	fn capture(vars: &[String], source: &mut impl FnMut(&str) -> Option<String>) -> Self {
		Self {
			vars: vars.iter().map(|var| (var.clone(), lookup(source, var).map(|value| fingerprint(&value)))).collect(),
		}
	}

	/// Variables only one side knows about are ignored — a changed declaration is
	/// a code change, not drift.
	fn diff(&self, other: &Self) -> Vec<VarChange> {
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

/// FNV-1a: answers "same or not" without a hashing dep. Not a security boundary
/// — the hash never leaves the process.
fn fingerprint(value: &str) -> u64 {
	const OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
	const PRIME: u64 = 0x0000_0100_0000_01b3;
	value.bytes().fold(OFFSET, |hash, byte| (hash ^ u64::from(byte)).wrapping_mul(PRIME))
}

#[cfg(test)]
mod tests {
	use super::*;

	fn snapshot(pairs: &[(&str, &str)]) -> Snapshot {
		Snapshot::capture(&["A".to_string(), "B".to_string()], &mut |var| {
			pairs.iter().find(|(key, _)| *key == var).map(|(_, value)| (*value).to_string())
		})
	}

	#[test]
	fn identical_sources_do_not_drift() {
		assert!(snapshot(&[("A", "1")]).diff(&snapshot(&[("A", "1")])).is_empty());
	}

	#[test]
	fn reports_appeared_disappeared_and_changed() {
		let at_boot = snapshot(&[("A", "1")]);
		assert_eq!(
			at_boot.diff(&snapshot(&[("A", "2"), ("B", "new")])),
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
		assert_eq!(
			at_boot.diff(&snapshot(&[])),
			vec![VarChange {
				var: "A".to_string(),
				kind: ChangeKind::Disappeared
			}]
		);
	}

	#[test]
	fn empty_is_unset_matches_the_parsing_contract() {
		assert!(snapshot(&[("A", "")]).diff(&snapshot(&[])).is_empty(), "`A=` and no `A` are the same state");
	}

	#[test]
	fn snapshots_never_retain_values() {
		assert!(!format!("{:?}", snapshot(&[("A", "hunter2")])).contains("hunter2"));
	}

	#[test]
	fn undeclared_variables_are_not_drift() {
		let undeclared = Snapshot::capture(&["A".to_string(), "UNDECLARED".to_string()], &mut |_| Some("x".to_string()));
		assert!(snapshot(&[("A", "x")]).diff(&undeclared).is_empty());
	}
}
