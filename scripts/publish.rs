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
//! cargo-release (the `cpublish` alias), then bump+publish every TS package that
//! changed since the last release wave to npm. "Impacted" is measured against the
//! previous `ev_lib-v*` tag, mirroring the release-wave model in CHANGELOG.md.

use std::{
	path::PathBuf,
	process::{Command, ExitCode},
};

fn run(cmd: &mut Command) {
	let status = cmd.status().expect("spawn");
	assert!(status.success(), "command failed: {cmd:?}");
}

fn capture(cmd: &mut Command) -> String {
	let out = cmd.output().expect("spawn");
	assert!(out.status.success(), "command failed: {cmd:?}");
	String::from_utf8(out.stdout).expect("utf8").trim().to_owned()
}

fn pkg_field<'a>(json: &'a serde_json::Value, key: &str) -> &'a str {
	json[key].as_str().unwrap_or_else(|| panic!("package.json missing string `{key}`"))
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

	// Captured before cargo-release tags a new wave, so the ts diff sees the old one.
	let prev_tag = Command::new("git")
		.args(["describe", "--tags", "--abbrev=0", "--match", "ev_lib-v*"])
		.output()
		.ok()
		.filter(|o| o.status.success())
		.map(|o| String::from_utf8_lossy(&o.stdout).trim().to_owned());

	let mut impacted: Vec<PathBuf> = Vec::new();
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
		if let Some(tag) = &prev_tag {
			let unchanged = Command::new("git")
				.args(["diff", "--quiet", tag, "--", dir.to_str().expect("utf8 path")])
				.status()
				.expect("git diff")
				.success();
			if unchanged {
				continue;
			}
		}
		impacted.push(dir);
	}

	// Rust: cargo-release versions, tags, commits, pushes and uploads to crates.io
	// (skipping unchanged workspace members on its own).
	run(Command::new("cargo").args(["release", "--no-confirm", "--execute", &level]));

	let mut tags: Vec<String> = Vec::new();
	for dir in &impacted {
		let read_manifest = || -> serde_json::Value { serde_json::from_str(&std::fs::read_to_string(dir.join("package.json")).expect("read package.json")).expect("parse package.json") };
		let name = pkg_field(&read_manifest(), "name").to_owned();
		println!(">> publishing {name}");
		run(Command::new("npm").arg("install").current_dir(dir));
		run(Command::new("npm").args(["version", &level, "--no-git-tag-version"]).current_dir(dir));
		run(Command::new("npm").arg("publish").current_dir(dir));
		let version = pkg_field(&read_manifest(), "version").to_owned();
		run(Command::new("git").arg("add").arg(dir));
		tags.push(format!("{name}-v{version}"));
	}

	if !tags.is_empty() {
		run(Command::new("git").args(["commit", "-m", "release: npm packages", "-m", &tags.join("\n")]));
		for tag in &tags {
			run(Command::new("git").args(["tag", tag.as_str()]));
		}
		run(Command::new("git").args(["push", "--follow-tags"]));
	}

	ExitCode::SUCCESS
}
