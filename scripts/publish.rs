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

/// A non-zero exit is an answer, not a panic: once one package is on the registry
/// every later step has to be able to fail without stranding it untagged.
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

/// The brand scaffold kitstart ships. It names the other @evinvest packages by
/// range and the lib flake by kitstart's tag, so a release that does not move
/// them leaves the template unable to install what was just published — which
/// is how kitstart 0.4.0 went out still pointing at `^0.3.0` (#163).
const TEMPLATE_MANIFEST: &str = "ts/kitstart/template/package.json";
const KITSTART: &str = "@evinvest/kitstart";
const KITSTART_TAG_FILES: &[&str] = &["ts/kitstart/template/flake.nix", "ts/kitstart/README.md"];

/// Does `range` admit `version`? The same slice of semver as
/// ts/kitstart/scripts/semver.mjs — the one check-template holds the template to:
/// `^`, `>=`, `<=`, `>`, `<`, `=`/bare, `*`, AND by space, `||`. `None` for
/// anything else, so an unreadable range is reported rather than guessed at.
fn admits(range: &str, version: &str) -> Option<bool> {
	fn parse(s: &str) -> Option<[u64; 3]> {
		let mut out = [0; 3];
		let mut parts = s.split('.');
		out[0] = parts.next()?.parse().ok()?;
		for slot in &mut out[1..] {
			if let Some(p) = parts.next() {
				*slot = p.parse().ok()?;
			}
		}
		parts.next().is_none().then_some(out)
	}
	let v = parse(version)?;
	let term = |t: &str| -> Option<bool> {
		if t.is_empty() || t == "*" {
			return Some(true);
		}
		let (op, rest) = ["^", ">=", "<=", ">", "<", "="].iter().find_map(|op| t.strip_prefix(op).map(|r| (*op, r))).unwrap_or(("", t));
		let b = parse(rest)?;
		Some(match op {
			"^" => {
				let upper = if b[0] > 0 {
					[b[0] + 1, 0, 0]
				} else if b[1] > 0 {
					[0, b[1] + 1, 0]
				} else {
					[0, 0, b[2] + 1]
				};
				v >= b && v < upper
			}
			">=" => v >= b,
			"<=" => v <= b,
			">" => v > b,
			"<" => v < b,
			_ => v == b,
		})
	};
	let mut any = false;
	for alt in range.split("||") {
		let mut all = true;
		for t in alt.split_whitespace() {
			all &= term(t)?;
		}
		any |= all;
	}
	Some(any)
}

/// Rewrite `name`'s range in a package.json text to `^version` when it does not
/// admit `version`. Textual on purpose: re-serialising would reorder keys and
/// reflow the file. `Ok(None)` when there is nothing to do.
fn bump_range(manifest: &str, name: &str, version: &str) -> Result<Option<String>, String> {
	let json: serde_json::Value = serde_json::from_str(manifest).map_err(|e| format!("parse: {e}"))?;
	let Some(range) = ["dependencies", "devDependencies"].iter().find_map(|k| json[k][name].as_str()) else {
		return Ok(None);
	};
	match admits(range, version) {
		Some(true) => return Ok(None),
		Some(false) => {}
		None => return Err(format!("cannot read the range {name}@{range}; set it to ^{version} by hand")),
	}
	let from = format!("\"{name}\": \"{range}\"");
	if manifest.matches(&from).count() != 1 {
		return Err(format!("expected exactly one `{from}`"));
	}
	Ok(Some(manifest.replacen(&from, &format!("\"{name}\": \"^{version}\""), 1)))
}

/// Point every `@evinvest/kitstart-v<x.y.z>` in `text` at `version`.
fn retag_kitstart(text: &str, version: &str) -> String {
	let marker = "@evinvest/kitstart-v";
	let mut out = String::with_capacity(text.len());
	let mut rest = text;
	while let Some(at) = rest.find(marker) {
		let (head, tail) = rest.split_at(at + marker.len());
		out.push_str(head);
		let end = tail.find(|c: char| !(c.is_ascii_digit() || c == '.')).unwrap_or(tail.len());
		let old = tail[..end].trim_end_matches('.');
		if old.is_empty() {
			rest = tail;
			continue;
		}
		out.push_str(version);
		rest = &tail[old.len()..];
	}
	out.push_str(rest);
	out
}

/// Move the template onto a version of `name` that has reached the registry (or,
/// for kitstart itself, is about to — see the call site). Returns the files it
/// changed, for the release commit.
fn point_template_at(name: &str, version: &str) -> Result<Vec<&'static str>, String> {
	let mut touched = Vec::new();
	let manifest = std::fs::read_to_string(TEMPLATE_MANIFEST).map_err(|e| format!("{TEMPLATE_MANIFEST}: {e}"))?;
	if let Some(next) = bump_range(&manifest, name, version).map_err(|e| format!("{TEMPLATE_MANIFEST}: {e}"))? {
		std::fs::write(TEMPLATE_MANIFEST, next).map_err(|e| format!("{TEMPLATE_MANIFEST}: {e}"))?;
		touched.push(TEMPLATE_MANIFEST);
	}
	if name == KITSTART {
		for file in KITSTART_TAG_FILES {
			let text = std::fs::read_to_string(file).map_err(|e| format!("{file}: {e}"))?;
			let next = retag_kitstart(&text, version);
			if next != text {
				std::fs::write(file, next).map_err(|e| format!("{file}: {e}"))?;
				touched.push(*file);
			}
		}
	}
	Ok(touched)
}

/// What `npm version <level>` will make of `current`, without running it. `None`
/// for anything but a plain `x.y.z`, which the template could not name anyway.
fn next_version(current: &str, level: &str) -> Option<String> {
	let mut parts = current.split('.').map(|p| p.parse::<u64>().ok());
	let (a, b, c) = (parts.next()??, parts.next()??, parts.next()??);
	if parts.next().is_some() {
		return None;
	}
	Some(match level {
		"major" => format!("{}.0.0", a + 1),
		"minor" => format!("{a}.{}.0", b + 1),
		"patch" => format!("{a}.{b}.{}", c + 1),
		_ => return None,
	})
}

fn has_kitstart_pin(text: &str) -> bool {
	text.match_indices("@evinvest/kitstart-v")
		.any(|(at, m)| text[at + m.len()..].starts_with(|c: char| c.is_ascii_digit()))
}

/// Walk the template through this run's releases, in publish order, without
/// writing anything. Whatever this returns would otherwise surface only after
/// the registry already holds a version the template cannot follow.
fn plan_template(manifest: &str, tag_files: &[(&str, String)], releases: &[(&str, String)]) -> Vec<String> {
	let mut errors = Vec::new();
	let mut current = manifest.to_owned();
	for (name, version) in releases {
		match bump_range(&current, name, version) {
			Ok(Some(next)) => current = next,
			Ok(None) => {}
			Err(e) => errors.push(format!("{TEMPLATE_MANIFEST}: {e}")),
		}
		if *name == KITSTART {
			for (file, text) in tag_files {
				if !has_kitstart_pin(text) {
					errors.push(format!("{file}: no `@evinvest/kitstart-v<x.y.z>` pin to move"));
				}
			}
		}
	}
	errors
}

/// Local release tags (`<name>-v<version>`) the remote does not have. `ls_remote`
/// is `git ls-remote --tags` output, where an annotated tag also shows as `^{}`.
fn missing_tags(local: &str, ls_remote: &str) -> Vec<String> {
	let remote: std::collections::HashSet<&str> = ls_remote
		.lines()
		.filter_map(|l| l.split('\t').nth(1))
		.map(|r| r.trim_start_matches("refs/tags/").trim_end_matches("^{}"))
		.collect();
	local.lines().map(str::trim).filter(|t| !t.is_empty() && !remote.contains(t)).map(str::to_owned).collect()
}

/// The remote this branch pushes to, or why a release from here cannot push.
fn upstream_remote() -> Result<String, String> {
	let branch = Command::new("git").args(["symbolic-ref", "--short", "HEAD"]).output().expect("spawn");
	if !branch.status.success() {
		return Err("HEAD is detached; release from a branch".to_owned());
	}
	let branch = String::from_utf8_lossy(&branch.stdout).trim().to_owned();
	let remote = Command::new("git").args(["config", &format!("branch.{branch}.remote")]).output().expect("spawn");
	if !remote.status.success() {
		return Err(format!("`{branch}` has no upstream; `git push -u origin {branch}` first"));
	}
	Ok(String::from_utf8_lossy(&remote.stdout).trim().to_owned())
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

	// The push is the last step, after the registry already has the packages; a
	// branch behind its upstream gets that push rejected, and a release that is on
	// npm but not in git is the hardest state to recover from. Find out now.
	let remote = match upstream_remote() {
		Ok(r) => r,
		Err(why) => {
			eprintln!("{why} — nothing was released.");
			return ExitCode::FAILURE;
		}
	};
	if !try_run(Command::new("git").args(["fetch", "--quiet", "--tags", &remote])) {
		eprintln!("`git fetch {remote}` failed, so whether this branch can push is unknown — nothing was released.");
		return ExitCode::FAILURE;
	}
	let behind = capture(Command::new("git").args(["rev-list", "--count", "HEAD..@{u}"]));
	if behind != "0" {
		eprintln!("this branch is {behind} commit(s) behind its upstream — nothing was released.");
		eprintln!("The release commit's push would be rejected after npm already has the packages.");
		eprintln!();
		eprintln!("    git pull --no-rebase    # then re-run");
		return ExitCode::FAILURE;
	}
	// A previous run whose push failed leaves its tags here only. `changed()` reads
	// the local ones, so this machine behaves; every other one would try to publish
	// over the live versions. Not fatal — say how to finish that run's job.
	if let Ok(out) = Command::new("git").args(["ls-remote", "--tags", &remote]).output()
		&& out.status.success()
	{
		let missing = missing_tags(&capture(Command::new("git").args(["tag", "-l", "*-v*"])), &String::from_utf8_lossy(&out.stdout));
		if !missing.is_empty() {
			eprintln!("!! release tags that {remote} does not have (an earlier run's push failed?):");
			eprintln!();
			eprintln!("    git push {remote} {}", missing.iter().map(|t| format!("refs/tags/{t}")).collect::<Vec<_>>().join(" "));
			eprintln!();
		}
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
		// uikit's `styles/*.css` are flattened from the repo-root sheets, so those
		// sources are part of what it publishes even though they live outside dir.
		let mut paths = vec![dir.to_str().expect("utf8 path")];
		if name == "@evinvest/uikit" {
			paths.extend(["tokens.css", "theme.css", "ev.css"]);
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

	// kitstart ships `template/` in its tarball, so it publishes last: by then the
	// template already names every package this run released before it.
	impacted.sort_by_key(|(_, name)| name == KITSTART);

	// Everything the loop below will do to the template, done first on paper: a
	// range it cannot move has to stop the run before cargo-release or npm.
	if !impacted.is_empty() {
		let manifest = std::fs::read_to_string(TEMPLATE_MANIFEST).expect("read template manifest");
		let listed: serde_json::Value = serde_json::from_str(&manifest).expect("parse template manifest");
		let names_it = |name: &str| ["dependencies", "devDependencies"].iter().any(|k| listed[k][name].is_string());
		let mut errors = Vec::new();
		let mut releases: Vec<(&str, String)> = Vec::new();
		for (dir, name) in &impacted {
			if name != KITSTART && !names_it(name) {
				continue;
			}
			match next_version(&version_of(dir), &level) {
				Some(next) => releases.push((name.as_str(), next)),
				None => errors.push(format!("{name}: cannot tell what `npm version {level}` makes of {}", version_of(dir))),
			}
		}
		let tag_files: Vec<(&str, String)> = KITSTART_TAG_FILES.iter().map(|f| (*f, std::fs::read_to_string(f).expect("read kitstart pin file"))).collect();
		errors.extend(plan_template(&manifest, &tag_files, &releases));
		if !errors.is_empty() {
			eprintln!("the kitstart template could not follow this release — nothing was released:");
			for e in &errors {
				eprintln!("  {e}");
			}
			return ExitCode::FAILURE;
		}
	}

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
	let mut failed: Vec<(String, &str)> = Vec::new();
	let mut template_errors: Vec<String> = Vec::new();
	let mut template_moved = false;
	let mut stage: Vec<PathBuf> = Vec::new();
	for (dir, name) in &impacted {
		println!(">> publishing {name}");

		// The bump has to happen before `npm publish` reads the manifest, so a failed
		// publish leaves the package claiming a version that was never released. Left
		// alone that poisons the next run: it bumps again from the phantom version, so
		// either a release number is skipped or the retry dies on "cannot publish over".
		// Snapshot what this package's steps write — the manifest, the lock `npm
		// install` and `npm version` both touch, and for kitstart the template — and
		// put it back byte for byte on any failure.
		let mut restore: Vec<(PathBuf, String)> = Vec::new();
		for file in ["package.json", "package-lock.json"] {
			let path = dir.join(file);
			if let Ok(text) = std::fs::read_to_string(&path) {
				restore.push((path, text));
			}
		}
		if name == KITSTART {
			for file in std::iter::once(TEMPLATE_MANIFEST).chain(KITSTART_TAG_FILES.iter().copied()) {
				restore.push((PathBuf::from(file), std::fs::read_to_string(file).expect("read template file")));
			}
		}
		let undo = || {
			for (path, text) in &restore {
				std::fs::write(path, text).expect("restore a file this run changed");
			}
		};

		// From here on a panic is not an option once anything reached the registry:
		// it would leave a published version with no commit or tag, and the next run
		// would publish yet another one. Stop the loop instead and let what did
		// publish be committed and tagged below.
		if !try_run(Command::new("npm").arg("install").current_dir(dir)) {
			undo();
			failed.push((name.clone(), "`npm install` failed; nothing after it was attempted"));
			break;
		}
		if !try_run(Command::new("npm").args(["version", &level, "--no-git-tag-version"]).current_dir(dir)) {
			undo();
			failed.push((name.clone(), "`npm version` failed; nothing after it was attempted"));
			break;
		}
		let version = version_of(dir);

		// kitstart's own version goes into the template BEFORE its publish, or the
		// tarball ships a scaffold that cannot install the very release it came in.
		// The preflight already walked this; failing here means the files changed
		// under the run, and a kitstart whose template is stale must not ship.
		if name == KITSTART {
			match point_template_at(name, &version) {
				Ok(files) => {
					template_moved |= !files.is_empty();
					for file in files {
						println!(">> template: {file} -> {name}@{version}");
					}
				}
				Err(e) => {
					undo();
					eprintln!("!! {name} not published: the template could not follow it: {e}");
					failed.push((name.clone(), "not published: its template could not be moved (see above)"));
					continue;
				}
			}
		}

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
			eprintln!(
				"!! {name} did not publish — restoring {}",
				restore.iter().map(|(p, _)| p.display().to_string()).collect::<Vec<_>>().join(", ")
			);
			undo();
			// One package's npm permissions are not a reason to strand the others: a
			// scoped token that cannot write to one name still publishes the rest.
			failed.push((name.clone(), "npm publish failed"));
			continue;
		}

		stage.push(dir.clone());
		tags.push(format!("{name}-v{version}"));
		if name != KITSTART {
			// Moved only now that the registry has it. Committed with the release even
			// when kitstart itself is not in this run: the template is part of
			// kitstart's tarball, so kitstart is pending from here (said at the end).
			match point_template_at(name, &version) {
				Ok(files) =>
					for file in files {
						template_moved = true;
						println!(">> template: {file} -> {name}@{version}");
						stage.push(PathBuf::from(file));
					},
				Err(e) => template_errors.push(e),
			}
		}
	}

	// Only what actually reached the registry gets committed and tagged. `changed()`
	// reads these tags to decide what needs releasing next time, so tagging an
	// unpublished package would quietly exclude it from every future run.
	let mut untagged: Vec<&String> = Vec::new();
	let mut unpushed = false;
	if !tags.is_empty() {
		let body = tags.join("\n");
		let committed = try_run(Command::new("git").arg("add").arg("--").args(&stage)) && try_run(Command::new("git").args(["commit", "-m", "release: npm packages", "-m", &body]));
		if !committed {
			eprintln!();
			eprintln!("!! npm has {} but the release commit failed. Finish it by hand, before", tags.join(", "));
			eprintln!("   anything else, or the next run publishes these again under new numbers:");
			eprintln!();
			eprintln!("    git add -- {}", stage.iter().map(|p| p.display().to_string()).collect::<Vec<_>>().join(" "));
			eprintln!("    git commit -m 'release: npm packages' -m '{body}'");
			for tag in &tags {
				eprintln!("    git tag -a {tag} -m {tag}");
			}
			eprintln!("    git push --follow-tags");
			return ExitCode::FAILURE;
		}
		for tag in &tags {
			// `-a` is load-bearing, not style. `--follow-tags` below pushes only
			// ANNOTATED tags, so a plain `git tag` created the tag locally and
			// silently left it behind — the release commit went up, the tag did
			// not. On any other machine `changed()` then saw the package as never
			// published and the next run tried to publish over the live version.
			// @evinvest/{uikit-v0.9.0,settings-v0.3.0,types-v0.3.0} were all
			// stranded this way, which is the real cause of the missing tags
			// AGENTS.md blames on hand-publishing.
			if !try_run(Command::new("git").args(["tag", "-a", tag.as_str(), "-m", tag.as_str()])) {
				untagged.push(tag);
			}
		}
		if !untagged.is_empty() {
			eprintln!();
			eprintln!("!! released and committed, but these tags were not created:");
			for tag in &untagged {
				eprintln!("    git tag -a {tag} -m {tag} HEAD");
			}
		}
		if !try_run(Command::new("git").args(["push", "--follow-tags"])) {
			unpushed = true;
			eprintln!();
			eprintln!("!! the push failed. npm has {} and the release commit and tags exist", tags.join(", "));
			eprintln!("   HERE ONLY: other machines will see these packages as unreleased. Finish it:");
			eprintln!();
			eprintln!("    git pull --no-rebase && git push --follow-tags");
			eprintln!();
			eprintln!("   Not a rebase: the tags point at the release commit as it is. The next run");
			eprintln!("   also lists any tag the remote is missing, with the command to push it.");
		}
	}

	// Not fatal mid-run — the packages are already on the registry and must still
	// be committed and tagged — but the release is not done until the template is.
	if !template_errors.is_empty() {
		eprintln!();
		eprintln!("!! the kitstart template was NOT moved onto this release:");
		for e in &template_errors {
			eprintln!("     {e}");
		}
		eprintln!("   Fix it by hand in a follow-up commit; kitstart's `npm test` fails until then.");
	}

	// The tarball already on npm carries the old template; only a kitstart release
	// ships the moved one.
	let kitstart_tag = format!("{KITSTART}-v");
	if template_moved && !tags.iter().any(|t| t.starts_with(&kitstart_tag)) {
		eprintln!();
		eprintln!(">> kitstart is now pending: its template moved, the published one did not. Release it:");
		eprintln!();
		eprintln!("    nix run .#publish -- {level} --npm-only --only {KITSTART}");
	}

	if !failed.is_empty() {
		eprintln!();
		eprintln!("published: {}", if tags.is_empty() { "nothing".to_owned() } else { tags.join(", ") });
		eprintln!("FAILED:");
		for (name, why) in &failed {
			eprintln!("    {name}: {why}");
		}
		if failed.iter().any(|(_, why)| *why == "npm publish failed") {
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
		}
	}

	if failed.is_empty() && template_errors.is_empty() && untagged.is_empty() && !unpushed {
		ExitCode::SUCCESS
	} else {
		ExitCode::FAILURE
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn admits_the_ranges_the_template_uses() {
		assert_eq!(admits("^0.22.0", "0.22.5"), Some(true));
		assert_eq!(admits("^0.22.0", "0.23.0"), Some(false));
		assert_eq!(admits("^0.0.3", "0.0.4"), Some(false));
		assert_eq!(admits("^1.2.0", "1.9.0"), Some(true));
		assert_eq!(admits(">=0.22.0 <1", "0.23.0"), Some(true));
		assert_eq!(admits(">=0.22.0 <1", "1.0.0"), Some(false));
		assert_eq!(admits("^0.3.0 || ^0.4.0", "0.4.1"), Some(true));
		assert_eq!(admits("*", "9.9.9"), Some(true));
		assert_eq!(admits("0.4.0", "0.4.0"), Some(true));
		assert_eq!(admits("~0.4.0", "0.4.0"), None);
		assert_eq!(admits("file:../uikit", "0.4.0"), None);
	}

	const MANIFEST: &str = "{\n  \"dependencies\": {\n    \"@evinvest/kitstart\": \"^0.3.0\",\n    \"@evinvest/uikit\": \"^0.22.0\"\n  }\n}\n";

	#[test]
	fn bumps_only_a_range_that_no_longer_admits() {
		let next = bump_range(MANIFEST, "@evinvest/uikit", "0.23.0").unwrap().unwrap();
		assert_eq!(next, MANIFEST.replace("\"^0.22.0\"", "\"^0.23.0\""));
		assert_eq!(bump_range(MANIFEST, "@evinvest/uikit", "0.22.4").unwrap(), None);
		assert_eq!(bump_range(MANIFEST, "@evinvest/settings", "0.4.0").unwrap(), None);
		assert!(bump_range(&MANIFEST.replace("^0.22.0", "~0.22.0"), "@evinvest/uikit", "0.23.0").is_err());
	}

	#[test]
	fn the_real_template_moves_one_line_per_package() {
		let real = include_str!("../ts/kitstart/template/package.json");
		for name in ["@evinvest/uikit", "@evinvest/kitstart", "@evinvest/marketing", "@evinvest/i18n", "@evinvest/analytics"] {
			let next = bump_range(real, name, "99.0.0").unwrap().unwrap_or_else(|| panic!("{name} not in the template"));
			let changed: Vec<_> = real.lines().zip(next.lines()).filter(|(a, b)| a != b).collect();
			assert_eq!(changed.len(), 1, "{name}: {changed:?}");
			assert!(changed[0].1.ends_with(&format!("\"{name}\": \"^99.0.0\",")), "{name}: {changed:?}");
		}
		for file in [include_str!("../ts/kitstart/template/flake.nix"), include_str!("../ts/kitstart/README.md")] {
			let next = retag_kitstart(file, "99.0.0");
			assert_eq!(next.lines().zip(file.lines()).filter(|(a, b)| a != b).count(), 1);
			assert!(next.contains("@evinvest/kitstart-v99.0.0\""));
		}
	}

	#[test]
	fn predicts_npm_version() {
		assert_eq!(next_version("0.23.0", "minor").as_deref(), Some("0.24.0"));
		assert_eq!(next_version("0.23.4", "patch").as_deref(), Some("0.23.5"));
		assert_eq!(next_version("0.23.4", "major").as_deref(), Some("1.0.0"));
		assert_eq!(next_version("1.0.0-rc.1", "patch"), None);
	}

	#[test]
	fn preflight_refuses_what_the_loop_could_not_move() {
		let pins = vec![("flake.nix", "ref=@evinvest/kitstart-v0.3.0\"".to_owned())];
		let releases = vec![("@evinvest/uikit", "0.23.0".to_owned()), ("@evinvest/kitstart", "0.4.0".to_owned())];
		assert!(plan_template(MANIFEST, &pins, &releases).is_empty());

		let unreadable = MANIFEST.replace("^0.22.0", "~0.22.0");
		let errors = plan_template(&unreadable, &pins, &releases);
		assert_eq!(errors.len(), 1, "{errors:?}");
		assert!(errors[0].contains("@evinvest/uikit@~0.22.0"), "{errors:?}");

		let unpinned = vec![("flake.nix", "ref=@evinvest/kitstart-vX.Y.Z".to_owned())];
		assert_eq!(plan_template(MANIFEST, &unpinned, &releases).len(), 1);
		// Only a kitstart release moves the pins, so only it needs them.
		assert!(plan_template(MANIFEST, &unpinned, &releases[..1]).is_empty());
	}

	#[test]
	fn finds_tags_the_remote_lacks() {
		let remote = "abc\trefs/tags/@evinvest/uikit-v0.23.0\nabd\trefs/tags/@evinvest/uikit-v0.23.0^{}\n";
		assert_eq!(missing_tags("@evinvest/uikit-v0.23.0\n@evinvest/kitstart-v0.5.0\n", remote), vec!["@evinvest/kitstart-v0.5.0"]);
		assert!(missing_tags("@evinvest/uikit-v0.23.0\n", remote).is_empty());
	}

	#[test]
	fn retags_every_kitstart_reference() {
		let text = "ref=@evinvest/kitstart-v0.3.0\";\n`@evinvest/kitstart-vX.Y.Z` tag.\nat @evinvest/kitstart-v0.3.0.\n";
		assert_eq!(
			retag_kitstart(text, "0.4.0"),
			"ref=@evinvest/kitstart-v0.4.0\";\n`@evinvest/kitstart-vX.Y.Z` tag.\nat @evinvest/kitstart-v0.4.0.\n"
		);
	}
}
