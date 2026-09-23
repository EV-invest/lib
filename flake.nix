{
  inputs = {
    v_flakes.url = "github:valeratrades/v_flakes?ref=v1.6";
  };

  outputs = { self, v_flakes }:
    let
      inherit (v_flakes) flake-utils pre-commit-hooks;
    in
    flake-utils.lib.eachDefaultSystem
      (
        system:
        let
          pkgs = import v_flakes.default_nixpkgs { inherit system; };

          # Canonical toolchain pinned in v_flakes — byte-identical across repos, so
          # the nix store dedups it and sccache cross-references compilations.
          rust = v_flakes.rs.default_nightly system;

          pname = "ev";

          # `nix run .#gen`: the one way to produce anything generated in this repo
          # — the TS class tables, the Tailwind class inventory, and the flattened
          # token sheets for both ports. See rust/gen/src/main.rs for the map.
          gen = pkgs.writeShellApplication {
            name = "gen";
            runtimeInputs = [ rust pkgs.git ];
            text = ''
              cd "$(git rev-parse --show-toplevel)"
              exec cargo run -q -p ev_lib_gen "$@"
            '';
          };

          # Local git hooks (treefmt etc.) — installed into .git/hooks at shell entry.
          pre-commit-check = pre-commit-hooks.lib.${system}.run (
            let base = v_flakes.files.preCommit { inherit pkgs; }; in
            base // {
              hooks = base.hooks // {
                # Regenerate and re-stage, rather than assert-and-fail. CI is off in
                # this repo (see the `github` module below), so an assertion would
                # have nothing to run it — and a stale generated file is silent:
                # Tailwind answers an undefined token by emitting no rule at all, so
                # a token sheet that drifted from its source shows up as a colour
                # quietly going missing on a consumer, not as a build error.
                generated = {
                  enable = true;
                  name = "regenerate derived files";
                  entry = "bash -c '${gen}/bin/gen && git add -A rust/classes/css rust/classes/uikit-classes.txt ts/uikit/src/generated ts/uikit/styles ts/i18n/src/generated ts/types/src/generated'";
                  pass_filenames = false;
                  require_serial = true;
                };
              };
            }
          );

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
            # The default job set stays off — the only thing CI enforces here is the
            # visual suite, because a stale baseline is otherwise invisible: `nix run
            # .#visual` is a command someone has to remember, and nobody does.
            jobs.errors.augment = [{ name = "flake-app"; args.app = "visual"; }];
            lastSupportedVersion = "nightly-2026-05-12";
            gitignore.extra = ''
              ## Node / TypeScript
              # No trailing slash: rust/tests/visual/node_modules is a symlink into
              # the store, and a dir-only pattern does not match a symlink.
              **/node_modules
              **/dist/
              **/*.tsbuildinfo
              ## LLMs
              AGENTS.md
              CLAUDE.md
              .claude/
            '';
            lfs = false;
          };

          readme = v_flakes.readme-fw {
            inherit pkgs pname;
            defaults = true;
            lastSupportedVersion = "nightly-1.92";
            rootDir = ./.;
            # No `ci` badge — it emits an errors *and* a warnings one, and only
            # `errors` is generated here, so the second would sit at "no status"
            # advertising a check that does not exist. No `loc` badge either: its
            # gist isn't created, so that endpoint 404s.
            badges = [ "msrv" "crates_io" "docs_rs" ];
          };

          combined = v_flakes.utils.combine { inherit rust; modules = [ rs github readme ]; };

          # `nix run .#publish -- <major|minor|patch>`: cargo-release for the crates
          # plus npm publish for every impacted ts package. See scripts/publish.rs;
          # this just provisions the toolchain and runs it as a cargo script.
          publish = pkgs.writeShellApplication {
            name = "publish";
            # `treefmt` is not decoration: cargo-release commits the version bump,
            # which fires this repo's own pre-commit hook, which shells out to it.
            # Without it every release dies mid-bump with `command not found`.
            runtimeInputs = [ rust pkgs.cargo-release pkgs.nodejs pkgs.git pkgs.treefmt ];
            text = ''
              cd "$(git rev-parse --show-toplevel)"
              # cargo-release verifies each tarball by compiling it out of the
              # registry cache, and sccache intermittently dies there (exit 254) —
              # the same reason v_flakes unsets this in every generated CI job. The
              # verification build is one-shot, so a compiler cache buys nothing.
              export RUSTC_WRAPPER=""
              exec cargo -Zscript -q scripts/publish.rs "$@"
            '';
          };

          # ── Visual regression (rust/tests/visual) ───────────────────────────
          # Every input the render reads is pinned here. The suite compares byte
          # for byte, so an unpinned input is not slack — it is a baseline that
          # moves under whoever runs next. See rust/tests/visual/README.md.
          visual =
            let
              fonts = pkgs.google-fonts.override { fonts = [ "Inter" "PlayfairDisplay" ]; };
            in
            rec {
              # Not `makeFontsConf`: that helper emits
              # `<include>/etc/fonts/conf.d</include>`, so the host's font set is
              # back in scope and the pin is decorative. Only `<dir>` here.
              fontsConf = pkgs.writeText "ev-visual-fonts.conf" ''
                <?xml version="1.0"?>
                <!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
                <fontconfig>
                  <dir>${fonts}/share/fonts</dir>
                  <cachedir prefix="xdg">fontconfig</cachedir>
                </fontconfig>
              '';

              # Served out of dist/ as `tailwind.js`, not fetched at capture time:
              # the snapshot derivation builds without network.
              tailwind = pkgs.fetchurl {
                url = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.14/dist/index.global.js";
                hash = "sha256-A4qFxQabLpAsXaQEn91022pgUy99EQcn+kWhVrYQ64U=";
              };

              # `playwright-test` carries the browser revision it was built
              # against, so runner and browsers cannot drift apart. The spec
              # imports `@playwright/test` from an ESM config, which node resolves
              # by walking `node_modules` upward — NODE_PATH is never consulted.
              nodeModules = "${pkgs.playwright-test}/lib/node_modules";

              env = {
                FONTCONFIG_FILE = "${fontsConf}";
                PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
                PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
                TAILWIND_BROWSER_JS = "${tailwind}";
              };
            };

          # The render is arch-insensitive and OS-sensitive (measured: 0 px across
          # x86_64/aarch64 linux, >1 % linux vs darwin), so capture is always a
          # *-linux derivation. On darwin nix routes it to `nix.linux-builder`,
          # which defaults to the host's arch — native, no emulation.
          linuxSystem = builtins.replaceStrings [ "darwin" ] [ "linux" ] system;

          # `dist/` is generated on the host rather than in here, so this needs no
          # cargo vendoring. If that ever made the HTML host-dependent it would
          # surface as a snapshot diff, which is the thing the suite is for.
          snapshotsFrom =
            dist:
            pkgs.runCommand "ev-visual-snapshots"
              (
                visual.env
                // {
                  nativeBuildInputs = [ pkgs.playwright-test pkgs.python3 ];
                }
              )
              ''
                mkdir -p "$out" "$NIX_BUILD_TOP/run"
                cd "$NIX_BUILD_TOP/run"
                cp -r ${dist} dist
                cp ${./rust/tests/visual/gallery.spec.ts} gallery.spec.ts
                cp ${./rust/tests/visual/playwright.config.ts} playwright.config.ts
                cp ${./rust/tests/visual/package.json} package.json
                ln -s ${visual.nodeModules} node_modules
                export HOME="$NIX_BUILD_TOP" EV_SNAPSHOT_OUT="$out"
                playwright test
              '';

          # Set by `visual` below, via `nix store add-path`. Impure by necessity:
          # a host-built directory has to reach a sandboxed build somehow.
          distPath = builtins.getEnv "EV_VISUAL_DIST";

          # ── Visual regression (ts/kitstart/test/visual) ─────────────────────
          # The kitstart widget gallery, on the same pinned runner, browsers, fonts
          # and Tailwind engine as the kit's suite. The pages are rendered on the
          # host by the gallery test (react-dom/server); only the capture is here.
          kitstartSnapshotsFrom =
            dist:
            pkgs.runCommand "kitstart-visual-snapshots"
              (
                visual.env
                // {
                  nativeBuildInputs = [ pkgs.playwright-test pkgs.python3 ];
                }
              )
              ''
                mkdir -p "$out" "$NIX_BUILD_TOP/run"
                cd "$NIX_BUILD_TOP/run"
                cp -r ${dist} dist
                cp ${./ts/kitstart/test/visual/gallery.spec.ts} gallery.spec.ts
                cp ${./ts/kitstart/test/visual/playwright.config.ts} playwright.config.ts
                cp ${./ts/kitstart/test/visual/package.json} package.json
                ln -s ${visual.nodeModules} node_modules
                export HOME="$NIX_BUILD_TOP" KITSTART_SNAPSHOT_OUT="$out"
                playwright test
              '';

          kitstartDistPath = builtins.getEnv "KITSTART_VISUAL_DIST";

          kitstart-visual-app = pkgs.writeShellApplication {
            name = "kitstart-visual";
            runtimeInputs = [ pkgs.nodejs pkgs.git pkgs.diffutils ];
            text = ''
              cd "$(git rev-parse --show-toplevel)/ts/kitstart"
              shots=test/visual/__screenshots__
              # kitstart links the workspace kit and marketing layer; a linked
              # directory ships whatever `dist/` it has, so build them first.
              for pkg in uikit marketing; do
                (cd "../$pkg" && { [ -d node_modules ] || npm ci --ignore-scripts; } && npm run build >/dev/null)
              done
              [ -d node_modules ] || npm ci --ignore-scripts
              KITSTART_VISUAL_OUT="$PWD/test/visual/dist" npx vitest run test/visual/gallery.node.test.tsx
              cp ${visual.tailwind} test/visual/dist/tailwind.js

              dist=$(nix store add-path test/visual/dist --name kitstart-visual-dist)
              out=$(KITSTART_VISUAL_DIST="$dist" nix build --impure --no-link --print-out-paths \
                ".#packages.${linuxSystem}.kitstart-visual-snapshots")

              if [ "''${1-}" = "--update" ]; then
                rm -f "$shots"/*.png
                install -m644 "$out"/*.png "$shots"/
                echo "kitstart baselines updated from $out"
              else
                diff -rq --exclude=README.md "$out" "$shots"
              fi
            '';
          };

          visual-app = pkgs.writeShellApplication {
            name = "visual";
            # `mold` because .cargo/config.toml links through it on linux; without
            # it every cargo invocation here dies at link time.
            runtimeInputs = [
              rust
              pkgs.git
              pkgs.diffutils
            ]
            ++ pkgs.lib.optionals pkgs.stdenv.isLinux [ pkgs.mold ];
            text = ''
              cd "$(git rev-parse --show-toplevel)"
              shots=rust/tests/visual/__screenshots__

              export TAILWIND_BROWSER_JS="${visual.tailwind}"
              # .cargo/config.toml routes cc through sccache, which needs a server
              # this one-shot generator has no reason to depend on — and which
              # fails outright on some hosts. Same opt-out as `publish`.
              export RUSTC_WRAPPER=""
              cargo test -q --test gallery --features uikit

              dist=$(nix store add-path rust/tests/visual/dist --name ev-visual-dist)
              out=$(EV_VISUAL_DIST="$dist" nix build --impure --no-link --print-out-paths \
                ".#packages.${linuxSystem}.visual-snapshots")

              if [ "''${1-}" = "--update" ]; then
                rm -f "$shots"/*.png
                install -m644 "$out"/*.png "$shots"/
                echo "baselines updated from $out"
              else
                diff -rq "$out" "$shots"
              fi
            '';
          };
        in
        {
          apps.publish = {
            type = "app";
            program = "${publish}/bin/publish";
          };

          apps.gen = {
            type = "app";
            program = "${gen}/bin/gen";
          };

          # `nix run .#visual [-- --update]`: regenerate dist/, capture all
          # baselines on linux, and compare byte for byte.
          apps.visual = {
            type = "app";
            program = "${visual-app}/bin/visual";
          };

          # `nix run .#kitstart-visual [-- --update]`: render the widget gallery,
          # capture it on linux, and compare byte for byte.
          apps.kitstart-visual = {
            type = "app";
            program = "${kitstart-visual-app}/bin/kitstart-visual";
          };

          # `lib.mkLanding` against a stand-in brand: the hermetic npm build from
          # its lockfile, the standalone install checks, and the size gate on
          # the result. `nix build .#checks.<system>.mk-landing-budget`.
          checks =
            let
              fixture = import ./nix/mk-landing.nix {
                inherit pkgs v_flakes;
                root = ./nix/mk-landing-fixture;
                pname = "mk-landing-fixture";
                sitePort = "59099";
                buildFiles = [ "package.json" "package-lock.json" "build.mjs" ];
                requiredFiles = [ "assets/fonts/Display.ttf" ];
              };
            in
            {
              mk-landing-site = fixture.checks.site;
              mk-landing-budget = fixture.checks.bundle-budget;
            }
            # The image is Linux's; the kitstart workflow builds it there.
            // pkgs.lib.optionalAttrs pkgs.stdenv.isLinux {
              mk-landing-container = fixture.packages.container;
            };

          packages.kitstart-visual-snapshots =
            if kitstartDistPath == "" then
              pkgs.runCommand "kitstart-visual-snapshots-no-dist" { } ''
                echo "KITSTART_VISUAL_DIST is unset — this is built through \`nix run .#kitstart-visual\`." >&2
                exit 1
              ''
            else
              kitstartSnapshotsFrom (builtins.storePath kitstartDistPath);

          packages.visual-snapshots =
            if distPath == "" then
              pkgs.runCommand "ev-visual-snapshots-no-dist" { } ''
                echo "EV_VISUAL_DIST is unset — this is built through \`nix run .#visual\`, which generates dist/ first." >&2
                exit 1
              ''
            else
              snapshotsFrom (builtins.storePath distPath);

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

                  ln -sfn ${visual.nodeModules} "$(git rev-parse --show-toplevel)/rust/tests/visual/node_modules"
                '';

              packages = [
                nodejs
                rust
                playwright-driver.browsers
                playwright-test
                python3
                sccache
              ]
              ++ lib.optionals stdenv.isLinux [ mold ]
              ++ pre-commit-check.enabledPackages
              ++ combined.enabledPackages;

              env = visual.env // {
                RUST_BACKTRACE = 1;
                RUSTC_WRAPPER = "sccache";
              };
            };
        }
      )
    // {
      # `ev.lib.mkLanding { pkgs; root = ./.; pname; sitePort; buildFiles; … }`
      # — the shared flake of every kitstart landing. See nix/mk-landing.nix.
      lib.mkLanding = import ./nix/mk-landing.nix;
    };
}
