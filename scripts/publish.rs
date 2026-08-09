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

//! `nix run .#publish -- <major|minor|patch>`: bump+publish the Rust crates via
//! cargo-release, then bump+publish every TS package, skipping any crate/package
//! with no changes since its own last `<name>-v*` tag (i.e. its last publish).
//! npm auth comes from `$NPM_TOKEN` via scripts/publish.npmrc.

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
	let level = match std::env::args().nth(1).as_deref() {
		Some(l @ ("major" | "minor" | "patch")) => l.to_owned(),
		_ => {
			eprintln!("usage: publish <major|minor|patch>");
			return ExitCode::FAILURE;
		}
	};

	let root = capture(Command::new("git").args(["rev-parse", "--show-toplevel"]));
	std::env::set_current_dir(&root).expect("cd to repo root");

	// Releasable rust crates and the pathspec that is "their own" sources. ev_lib
	// is everything under rust/ except the nested crates; uikit-viewer is
	// publish=false. cargo-release bumps unchanged members too (only warning), so
	// we select the changed ones ourselves.
	const RUST: &[(&str, &[&str])] = &[
		("ev_lib_classes", &["rust/classes"]),
		("ev_lib_gen", &["rust/gen"]),
		("ev_lib", &["rust", ":!rust/classes", ":!rust/gen", ":!rust/uikit-viewer"]),
	];
	let rust_changed: Vec<&str> = RUST.iter().filter(|(name, paths)| changed(name, paths)).map(|(name, _)| *name).collect();

	let mut impacted: Vec<(PathBuf, String)> = Vec::new();
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
		// uikit's `styles/tokens.css` is copied in by its `prepare` script, so the
		// root source is part of what it publishes even though it lives outside dir.
		let mut paths = vec![dir.to_str().expect("utf8 path")];
		if name == "@evinvest/uikit" {
			paths.push("tokens.css");
		}
		if changed(&name, &paths) {
			impacted.push((dir, name));
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
	if !rust_changed.is_empty() {
		let mut cmd = Command::new("cargo");
		cmd.args(["release", "--no-confirm", "--execute", &level]);
		for c in &rust_changed {
			cmd.args(["-p", c]);
		}
		run(&mut cmd);
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

		if !try_run(Command::new("npm").arg("publish").current_dir(dir).env("NPM_CONFIG_USERCONFIG", &npmrc)) {
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
			run(Command::new("git").args(["tag", tag.as_str()]));
		}
		run(Command::new("git").args(["push", "--follow-tags"]));
	}

	if !failed.is_empty() {
		eprintln!();
		eprintln!("published: {}", if tags.is_empty() { "nothing".to_owned() } else { tags.join(", ") });
		eprintln!("FAILED:    {}", failed.join(", "));
		eprintln!();
		eprintln!("A 404 on PUT to an existing package means authenticated but not authorised —");
		eprintln!("npm hides the difference. Check that $NPM_TOKEN's account maintains those");
		eprintln!("packages, and that a granular token lists them.");
		return ExitCode::FAILURE;
	}

	ExitCode::SUCCESS
}
