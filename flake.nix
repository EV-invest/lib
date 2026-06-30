{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    rust-overlay.url = "github:oxalica/rust-overlay";
    rust-overlay.inputs.nixpkgs.follows = "nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
    pre-commit-hooks.url = "github:cachix/git-hooks.nix";
    pre-commit-hooks.inputs.nixpkgs.follows = "nixpkgs";
    v_flakes.url = "github:valeratrades/v_flakes?ref=v1.6";
    v_flakes.inputs.nixpkgs.follows = "nixpkgs";
    v_flakes.inputs.rust-overlay.follows = "rust-overlay";
  };

  outputs = { self, nixpkgs, rust-overlay, flake-utils, pre-commit-hooks, v_flakes }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };

        # Nightly toolchain: the org `rustfmt.toml` uses unstable features and the
        # generated cargo config enables the cranelift backend — both nightly-only.
        # `wasm32` is included because the `architecture` crate is I/O-free and
        # wasm-safe (`cargo check --target wasm32-unknown-unknown`).
        rust = pkgs.rust-bin.selectLatestNightlyWith (toolchain: toolchain.default.override {
          extensions = [ "rust-src" "rust-analyzer" "rust-docs" "rustc-codegen-cranelift-preview" ];
          targets = [ "wasm32-unknown-unknown" ];
        });

        pname = "ev";

        # Local git hooks (treefmt etc.) — installed into .git/hooks at shell entry.
        pre-commit-check = pre-commit-hooks.lib.${system}.run (v_flakes.files.preCommit { inherit pkgs; });

        # The crate's sources live in `rust/`, but the org tooling drives cargo
        # from the repo root (anchored by the thin workspace in ./Cargo.toml), so
        # the root-relative file management here lands correctly. build.rs
        # generation is off — `ev` is a pure library with no build script.
        rs = v_flakes.rs {
          inherit pkgs rust;
          build.enable = false;
        };

        github = v_flakes.github {
          inherit pkgs pname rs;
          enable = true;
          # CI workflows intentionally left off for now (no `jobs.default`), so
          # nothing is generated under .github/workflows. The rest of the github
          # module (gitignore/gitattributes, pre-commit hook) still applies.
          lastSupportedVersion = "nightly-2026-05-12";
          gitignore.extra = ''
            ## Node / TypeScript
            **/node_modules/
            **/dist/
            **/*.tsbuildinfo
            ## LLMs
            AGENTS.md
            CLAUDE.md
            .claude/
            .pre-commit-config.yaml
          '';
          lfs = false;
        };

        readme = v_flakes.readme-fw {
          inherit pkgs pname;
          defaults = true;
          lastSupportedVersion = "nightly-1.92";
          rootDir = ./.;
          # No `ci` badge (CI off) and no `loc` badge (its gist isn't created
          # without CI, so the endpoint 404s as "custom badge / resource not found").
          badges = [ "msrv" "crates_io" "docs_rs" ];
        };

        combined = v_flakes.utils.combine { inherit rust; modules = [ rs github readme ]; };

        # `nix run .#publish -- <major|minor|patch>`: cargo-release for the crates
        # plus npm publish for every impacted ts package. See scripts/publish.rs;
        # this just provisions the toolchain and runs it as a cargo script.
        publish = pkgs.writeShellApplication {
          name = "publish";
          runtimeInputs = [ rust pkgs.cargo-release pkgs.nodejs pkgs.git ];
          text = ''
            cd "$(git rev-parse --show-toplevel)"
            exec cargo -Zscript -q scripts/publish.rs "$@"
          '';
        };
      in
      {
        apps.publish = {
          type = "app";
          program = "${publish}/bin/publish";
        };

        devShells.default =
          with pkgs;
          mkShell {
            shellHook =
              pre-commit-check.shellHook
              + combined.shellHook
              + ''
                cp -f ${(v_flakes.files.treefmt) { inherit pkgs; }} ./.treefmt.toml

                # macOS: the nightly toolchain resolves libLLVM via a fallback path
                # when linking host proc-macros (serde/uuid derives) and rust-lld
                # (wasm32); without this they abort on missing LLVM symbols. The
                # var is macOS-only, so this is a no-op on Linux.
                export DYLD_FALLBACK_LIBRARY_PATH="${rust}/lib''${DYLD_FALLBACK_LIBRARY_PATH:+:$DYLD_FALLBACK_LIBRARY_PATH}"
              '';

            packages = [
              nodejs
              rust
              playwright-driver.browsers
              sccache
            ]
            ++ lib.optionals stdenv.isLinux [ mold ]
            ++ pre-commit-check.enabledPackages
            ++ combined.enabledPackages;

            env.RUST_BACKTRACE = 1;

            # Playwright (uikit visual-regression, rust/tests/visual): drive the
            # nixpkgs-provided browsers instead of the npm-downloaded ones (those
            # are dynamically linked against libs absent on NixOS). The npm
            # @playwright/test version MUST match playwright-driver's or the
            # browser revisions won't line up.
            env.PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
            env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
            env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = "nixos";

            env.RUSTC_WRAPPER = "sccache";
          };
      }
    );
}
