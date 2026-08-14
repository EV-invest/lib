#!/usr/bin/env nix
---cargo
#! nix shell --impure --expr ``
#! nix let rust_flake = builtins.getFlake ''github:oxalica/rust-overlay'';
#! nix     nixpkgs_flake = builtins.getFlake ''nixpkgs'';
#! nix     pkgs = import nixpkgs_flake {
#! nix       system = builtins.currentSystem;
#! nix       overlays = [rust_flake.overlays.default];
#! nix     };
#! nix     toolchain = pkgs.rust-bin.selectLatestNightlyWith (t: t.default);
#! nix in pkgs.mkShell {
#! nix   buildInputs = [ toolchain pkgs.nix pkgs.git pkgs.nodejs pkgs.cargo-release ];
#! nix }
#! nix ``
#! nix --command sh -c ``cargo -Zscript -q "$0" "$@"``

[package]
edition = "2024"

[dependencies]
serde_json = "1"
---

//! `nix run .#publish -- <major|minor|patch> [--npm-only] [--only <name>]...`:
//! bump+publish the Rust crates via cargo-release, then bump+publish every TS
//! package, skipping any crate/package with no changes since its own last
//! `<name>-v*` tag (i.e. its last publish). npm auth comes from `$NPM_TOKEN` via
//! scripts/publish.npmrc.
//!
//! By default everything pending is released together, which is usually right —
//! but one bump level then applies to all of it, and the crates go to crates.io.
//! Two escape hatches, because "release this one thing" is otherwise impossible:
//!
//!   --only <name>   restrict to these crates/packages by exact name, repeatable.
//!                   Anything pending but unnamed is left for a later run.
//!   --skip <name>   the complement: release everything pending EXCEPT these.
//!                   For a crate this account cannot publish at all (see the
//!                   ownership note in the failure handler), --only would mean
//!                   listing every other package by hand on every release.
//!   --npm-only      skip cargo-release entirely; publish only TS packages.
//!
//! Both narrow the set — neither can widen it past what actually changed, so a
//! `--only` naming an unchanged package releases nothing rather than forcing a
//! version out.

use std::{
	path::PathBuf,
	process::{Command, ExitCode},
};

fn run(cmd: &mut Command) {
	let status = cmd.status().expect("spawn");
	assert!(status.success(), "command failed: {cmd:?}");
}

/// Like `run`, but a non-zero exit is an answer rather than the end of the release.
fn try_run(cmd: &mut Command) -> bool {
	cmd.status().expect("spawn").success()
}

/// Run a command, streaming nothing but keeping stdout+stderr, and report both
/// the outcome and what it said. Used for cargo-release, whose failure mode has
/// to be *read* to be diagnosed — and which must not be re-run to find out.
fn run_capturing(cmd: &mut Command) -> (bool, String) {
	let out = cmd.output().expect("spawn");
	let mut text = String::from_utf8_lossy(&out.stdout).into_owned();
	text.push_str(&String::from_utf8_lossy(&out.stderr));
	// The operator still needs to see it; capturing is for diagnosis, not silence.
	print!("{text}");
	(out.status.success(), text)
}

fn version_of(dir: &std::path::Path) -> String {
	let json: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(dir.join("package.json")).expect("read package.json")).expect("parse package.json");
	json["version"].as_str().expect("package.json version").to_owned()
}

fn capture(cmd: &mut Command) -> String {
	let out = cmd.output().expect("spawn");
	assert!(out.status.success(), "command failed: {cmd:?}");
	String::from_utf8(out.stdout).expect("utf8").trim().to_owned()
}

fn last_tag(glob: &str) -> Option<String> {
	Command::new("git")
		.args(["describe", "--tags", "--abbrev=0", "--match", glob])
		.output()
		.ok()
		.filter(|o| o.status.success())
		.map(|o| String::from_utf8_lossy(&o.stdout).trim().to_owned())
}

/// Changed since the last `{prefix}-v*` tag, restricted to `paths` (git pathspec).
/// No such tag means never published -> treat as changed.
fn changed(prefix: &str, paths: &[&str]) -> bool {
	match last_tag(&format!("{prefix}-v*")) {
		None => true,
		Some(tag) => !Command::new("git").args(["diff", "--quiet", &tag, "--"]).args(paths).status().expect("git diff").success(),
	}
}

fn main() -> ExitCode {
	let args: Vec<String> = std::env::args().skip(1).collect();
	let level = match args.first().map(String::as_str) {
		Some(l @ ("major" | "minor" | "patch")) => l.to_owned(),
		_ => {
			eprintln!("usage: publish <major|minor|patch> [--npm-only] [--only <name>]... [--skip <name>]... [--otp <code>]");
			return ExitCode::FAILURE;
		}
	};

	let mut npm_only = false;
	let mut only: Vec<String> = Vec::new();
	let mut skip: Vec<String> = Vec::new();
	let mut otp: Option<String> = None;
	let mut rest = args[1..].iter();
	while let Some(arg) = rest.next() {
		match arg.as_str() {
			"--npm-only" => npm_only = true,
			"--only" => match rest.next() {
				Some(name) => only.push(name.clone()),
				None => {
					eprintln!("--only needs a package name");
					return ExitCode::FAILURE;
				}
			},
			"--skip" => match rest.next() {
				Some(name) => skip.push(name.clone()),
				None => {
					eprintln!("--skip needs a package name");
					return ExitCode::FAILURE;
				}
			},
			"--otp" => match rest.next() {
				Some(code) => otp = Some(code.clone()),
				None => {
					eprintln!("--otp needs the six-digit code from your authenticator");
					return ExitCode::FAILURE;
				}
			},
			other => {
				eprintln!("unknown argument: {other}");
				eprintln!("usage: publish <major|minor|patch> [--npm-only] [--only <name>]... [--skip <name>]... [--otp <code>]");
				return ExitCode::FAILURE;
			}
		}
	}
	// Empty `only` means "no restriction", so this has to be a membership test
	// rather than a filter that would otherwise drop everything. `skip` then
	// subtracts, and subtracts last: naming something in both is a contradiction,
	// and the safe reading of a contradiction is "don't publish it".
	let selected = |name: &str| (only.is_empty() || only.iter().any(|o| o == name)) && !skip.iter().any(|s| s == name);

	let root = capture(Command::new("git").args(["rev-parse", "--show-toplevel"]));
	std::env::set_current_dir(&root).expect("cd to repo root");

	// cargo-release refuses to run against a dirty tree, and it refuses *late* —
	// after this script has printed the release plan and authenticated with npm,
	// which together read exactly like a run that is about to succeed. Worse, the
	// files it objects to are usually a half-finished version bump from a previous
	// failed release, so the operator sees an error about the very thing they were
	// trying to publish. Check first, and name the files.
	let dirty = capture(Command::new("git").args(["status", "--porcelain"]));
	if !dirty.is_empty() {
		eprintln!("working tree is not clean — nothing was released.");
		eprintln!();
		for line in dirty.lines() {
			eprintln!("  {line}");
		}
		eprintln!();
		eprintln!("cargo-release requires a clean tree so a release commit contains only the");
		eprintln!("version bump. Commit or stash the above, then re-run.");
		eprintln!();
		eprintln!("If these are a version bump left behind by a release that failed partway,");
		eprintln!("committing them is usually right: the registry already has that version, so");
		eprintln!("the manifest is catching up with what shipped, not claiming something new.");
		return ExitCode::FAILURE;
	}

	// Releasable rust crates and the pathspec that is "their own" sources. ev_lib
	// is everything under rust/ except the nested crates; uikit-viewer is
	// publish=false. cargo-release bumps unchanged members too (only warning), so
	// we select the changed ones ourselves.
	const RUST: &[(&str, &[&str])] = &[
		("ev_lib_classes", &["rust/classes"]),
		("ev_lib_gen", &["rust/gen"]),
		("ev_lib", &["rust", ":!rust/classes", ":!rust/gen", ":!rust/uikit-viewer"]),
	];
	let rust_changed: Vec<&str> = if npm_only {
		Vec::new()
	} else {
		RUST.iter().filter(|(name, paths)| selected(name) && changed(name, paths)).map(|(name, _)| *name).collect()
	};

	let mut impacted: Vec<(PathBuf, String)> = Vec::new();
	let mut known: Vec<String> = RUST.iter().map(|(n, _)| (*n).to_owned()).collect();
	for entry in std::fs::read_dir("ts").expect("read ts/") {
		let dir = entry.expect("dir entry").path();
		let manifest = dir.join("package.json");
		if !manifest.exists() {
			continue;
		}
		let json: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&manifest).expect("read package.json")).expect("parse package.json");
		if json["private"].as_bool() == Some(true) {
			continue;
		}
		let name = json["name"].as_str().expect("package.json name").to_owned();
		known.push(name.clone());
		// uikit's `styles/tokens.css` is copied in by its `prepare` script, so the
		// root source is part of what it publishes even though it lives outside dir.
		let mut paths = vec![dir.to_str().expect("utf8 path")];
		if name == "@evinvest/uikit" {
			paths.push("tokens.css");
		}
		if selected(&name) && changed(&name, &paths) {
			impacted.push((dir, name));
		}
	}

	// A misspelled --only would otherwise select nothing and exit successfully,
	// which reads exactly like a clean release that published everything asked for.
	let unknown: Vec<&String> = only.iter().chain(skip.iter()).filter(|o| !known.contains(o)).collect();
	if !unknown.is_empty() {
		eprintln!("--only/--skip named nothing releasable: {}", unknown.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(", "));
		eprintln!("releasable names are: {}", known.join(", "));
		return ExitCode::FAILURE;
	}

	// Say what this run covers before it starts changing versions, so a narrowed
	// release cannot look like a full one in the log.
	if !only.is_empty() || !skip.is_empty() || npm_only {
		let mut how: Vec<String> = Vec::new();
		if npm_only {
			how.push("npm only".to_owned());
		}
		if !only.is_empty() {
			how.push(format!("--only {}", only.join(" ")));
		}
		if !skip.is_empty() {
			how.push(format!("--skip {}", skip.join(" ")));
		}
		eprintln!(">> narrowed release: {}", how.join(", "));
	}
	eprintln!(">> releasing crates: {}", if rust_changed.is_empty() { "none".to_owned() } else { rust_changed.join(", ") });
	eprintln!(
		">> releasing npm:    {}",
		if impacted.is_empty() {
			"none".to_owned()
		} else {
			impacted.iter().map(|(_, n)| n.as_str()).collect::<Vec<_>>().join(", ")
		}
	);

	let npmrc = PathBuf::from(&root).join("scripts/publish.npmrc");

	// Fail before releasing anything if npm publishing can't authenticate. Checking the
	// variable is merely present is not the same as checking it works: an expired token
	// used to get all the way to `npm publish` and die there, after cargo-release had
	// already versioned, tagged and pushed the crates. Ask the registry who we are.
	if !impacted.is_empty() {
		if std::env::var_os("NPM_TOKEN").is_none() {
			eprintln!("NPM_TOKEN must be set to publish {} npm package(s)", impacted.len());
			return ExitCode::FAILURE;
		}
		match Command::new("npm").arg("whoami").env("NPM_CONFIG_USERCONFIG", &npmrc).output() {
			Ok(out) if out.status.success() => println!(">> npm authenticated as {}", String::from_utf8_lossy(&out.stdout).trim()),
			_ => {
				eprintln!("NPM_TOKEN is set but the registry rejects it — nothing was released.");
				return ExitCode::FAILURE;
			}
		}
	}

	// Rust: cargo-release versions, tags, commits, pushes and uploads to crates.io.
	//
	// In that order — which is the whole problem when the upload fails. By the time
	// crates.io says no, the version bump is already a commit in the branch, so a
	// panic here does not leave the repo as it found it. Remember where we were and
	// hand the operator the exact way back.
	if !rust_changed.is_empty() {
		let before = capture(Command::new("git").args(["rev-parse", "HEAD"]));
		let mut cmd = Command::new("cargo");
		cmd.args(["release", "--no-confirm", "--execute", &level]);
		for c in &rust_changed {
			cmd.args(["-p", c]);
		}
		let (ok, output) = run_capturing(&mut cmd);
		if !ok {
			let after = capture(Command::new("git").args(["rev-parse", "HEAD"]));
			eprintln!();
			eprintln!("cargo-release failed. No npm package was touched.");
			eprintln!();

			// crates.io answers "not an owner" with a 403 that names no crate, so the
			// operator is left guessing which of several `-p` crates it meant.
			if output.contains("you don't seem to be an owner") || output.contains("403 Forbidden") {
				eprintln!("crates.io refused the upload: this account does not own one of these crates.");
				eprintln!();
				eprintln!("This is not transient and re-running will not fix it. Check who owns what:");
				eprintln!();
				for c in &rust_changed {
					eprintln!("    cargo owner --list {c}");
				}
				eprintln!();
				eprintln!("Ownership is per crate, so a crate someone else created stays unpublishable");
				eprintln!("from here until they add this account (`cargo owner --add <login> <crate>`).");
				eprintln!("Until then, route around it — every other pending package still releases:");
				eprintln!();
				eprintln!("    nix run .#publish -- {level} --skip <crate>");
				eprintln!();
			}

			if before != after {
				eprintln!("cargo-release had already committed before it failed. The repo is NOT as");
				eprintln!("it was: HEAD moved {} -> {}.", &before[..12.min(before.len())], &after[..12.min(after.len())]);
				eprintln!();
				eprintln!("To undo the version bump it left behind:");
				eprintln!();
				eprintln!("    git reset --hard {before}");
				eprintln!("    git tag --points-at {after}   # then `git tag -d` any it lists");
				eprintln!();
				eprintln!("Do that before the next release. Left in place, the bumped version is one");
				eprintln!("the registry never received, so the next run bumps again from a number that");
				eprintln!("does not exist and the release history skips a version.");
			} else {
				eprintln!("HEAD did not move, so nothing needs undoing.");
			}
			return ExitCode::FAILURE;
		}
	}

	let mut tags: Vec<String> = Vec::new();
	let mut failed: Vec<String> = Vec::new();
	for (dir, name) in &impacted {
		println!(">> publishing {name}");
		run(Command::new("npm").arg("install").current_dir(dir));

		// The bump has to happen before `npm publish` reads the manifest, so a failed
		// publish leaves the package claiming a version that was never released. Left
		// alone that poisons the next run: it bumps again from the phantom version, so
		// either a release number is skipped or the retry dies on "cannot publish over".
		// Remember what to go back to.
		let previous = version_of(dir);
		run(Command::new("npm").args(["version", &level, "--no-git-tag-version"]).current_dir(dir));

		// `--otp` when the account enforces 2FA on publish. A token that reads
		// fine still cannot write: npm answers by starting its interactive
		// web-login flow ("Authenticate your account at …"), which in a
		// non-interactive run dies polling an auth handshake nobody completed —
		// and surfaces as a 404, which looks exactly like a permissions problem
		// and is not one. An automation token avoids the whole dance; this flag
		// is for publishing from a laptop with an authenticator to hand.
		let mut publish = Command::new("npm");
		publish.arg("publish").current_dir(dir).env("NPM_CONFIG_USERCONFIG", &npmrc);
		if let Some(code) = &otp {
			publish.arg(format!("--otp={code}"));
		}
		if !try_run(&mut publish) {
			eprintln!("!! {name} did not publish — restoring {previous}");
			run(Command::new("npm").args(["version", &previous, "--no-git-tag-version", "--allow-same-version"]).current_dir(dir));
			failed.push(name.clone());
			// One package's npm permissions are not a reason to strand the others: a
			// scoped token that cannot write to one name still publishes the rest.
			continue;
		}

		run(Command::new("git").arg("add").arg(dir));
		tags.push(format!("{name}-v{}", version_of(dir)));
	}

	// Only what actually reached the registry gets committed and tagged. `changed()`
	// reads these tags to decide what needs releasing next time, so tagging an
	// unpublished package would quietly exclude it from every future run.
	if !tags.is_empty() {
		run(Command::new("git").args(["commit", "-m", "release: npm packages", "-m", &tags.join("\n")]));
		for tag in &tags {
			// `-a` is load-bearing, not style. `--follow-tags` below pushes only
			// ANNOTATED tags, so a plain `git tag` created the tag locally and
			// silently left it behind — the release commit went up, the tag did
			// not. On any other machine `changed()` then saw the package as never
			// published and the next run tried to publish over the live version.
			// @evinvest/{uikit-v0.9.0,settings-v0.3.0,types-v0.3.0} were all
			// stranded this way, which is the real cause of the missing tags
			// AGENTS.md blames on hand-publishing.
			run(Command::new("git").args(["tag", "-a", tag.as_str(), "-m", tag.as_str()]));
		}
		run(Command::new("git").args(["push", "--follow-tags"]));
	}

	if !failed.is_empty() {
		eprintln!();
		eprintln!("published: {}", if tags.is_empty() { "nothing".to_owned() } else { tags.join(", ") });
		eprintln!("FAILED:    {}", failed.join(", "));
		eprintln!();
		eprintln!("npm reports several different failures as a 404. Read the output above:");
		eprintln!();
		eprintln!("  \"Authenticate your account at https://www.npmjs.com/auth/cli/…\"");
		eprintln!("      2FA is enforced on publish and the token cannot satisfy it. The token");
		eprintln!("      is fine — it read the registry to get here. Re-run with --otp <code>,");
		eprintln!("      or use an automation token, which bypasses 2FA by design.");
		eprintln!();
		eprintln!("  a 404 on PUT to a package that already exists");
		eprintln!("      authenticated but not authorised. Check that $NPM_TOKEN's account");
		eprintln!("      maintains those packages, and that a granular token lists them.");
		eprintln!();
		eprintln!("  a 404 on a package that does not exist yet");
		eprintln!("      a granular token cannot create a new name — it can only list packages");
		eprintln!("      that already exist. Use an automation or classic token for a first");
		eprintln!("      publish.");
		return ExitCode::FAILURE;
	}

	ExitCode::SUCCESS
}
