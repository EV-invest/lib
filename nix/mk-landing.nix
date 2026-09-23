# `lib.mkLanding`: everything a landing's flake.nix shares, ported from the
# aquafix flake — the hermetic `next build` from package-lock.json, the OCI
# image, the bundle-budget check, the container smoke, the dev/test apps and
# the dev shell. A brand's flake.nix (see ts/kitstart/template/flake.nix):
#
#   landing = ev.lib.mkLanding {
#     inherit pkgs v_flakes;
#     root = ./.;
#     pname = "vifnet"; sitePort = "59082";
#     buildFiles = [ "package.json" "package-lock.json" "app" "src" "assets"
#                    "next.config.ts" "tsconfig.json" "postcss.config.mjs"
#                    "proxy.ts" "instrumentation.ts" ];
#     prodEnv = import ./deploy/config.nix { port = "59082"; };
#     smoke = { page = "/fr"; og = "/og?l=paris"; quote = { location = "paris"; … }; };
#   };
#   packages = landing.packages; checks = landing.checks;
#   apps = landing.apps; devShells.default = landing.devShell;
#
# The npm version of @evinvest/kitstart and the lib flake revision move
# together: pin the flake to the tag `@evinvest/kitstart-vX.Y.Z` of the version
# in package-lock.json (checked below), with `inputs.v_flakes.follows`.
{ pkgs
, # The brand repo's root (`./.` in its flake).
  root
, pname
, sitePort
, # Paths under `root` the build reads; nothing else reaches the sandbox.
  buildFiles
, # Secret-free prod env baked into the image (deploy/config.nix).
  prodEnv ? { }
, # For the OCI image; without it there is no `container` package.
  v_flakes ? null
, # `node:sqlite` without a flag needs >= 22.13. The image gets the slim build:
  # the same node without npm.
  nodejs ? pkgs.nodejs_22
, nodeRuntime ? pkgs.nodejs-slim_22
, budgetFile ? "tests/bundle_budget.txt"
, gatedRoute ? "/[locale]/[location]"
, # Files the standalone output must carry (the OG route's fonts), checked
  # after the build: tracing cannot infer a path read at run time.
  requiredFiles ? [ ]
, mounts ? [ "/data" ]
, criticality ? "high"
, # What `container-smoke` asks the image: a page (with a Host header for a
  # subdomains site), the OG card, and optionally a form POST whose lead must
  # land in the first mount.
  smoke ? { page = "/fr"; }
, # The flake attribute of the image the smoke boots.
  containerAttr ? ".#container"
, # Refuse a lockfile whose @evinvest/kitstart is not this lib revision's.
  # Off only for a flake that builds no kitstart landing.
  checkKitstartVersion ? true
, # Playwright's config for `apps.test` / `apps.accept-test`.
  e2eConfig ? "tests/e2e"
, # Sources for lockfile entries the registry cannot serve yet — a `file:` or
  # vendored tarball of an unpublished @evinvest package — keyed like the
  # lock (`"node_modules/@evinvest/kitstart" = ./vendor/kitstart.tgz;`). They
  # win over the platform pruning.
  packageSourceOverrides ? { }
,
}:
let
  lib = pkgs.lib;
  manifest = lib.importJSON (root + "/package.json");
  version = manifest.version or "0.0.0";
  npmLock = lib.importJSON (root + "/package-lock.json");

  # ── the npm version ↔ this flake revision ──────────────────────────────
  libKitstart = (lib.importJSON ../ts/kitstart/package.json).version;
  lockedKitstart = npmLock.packages."node_modules/@evinvest/kitstart".version or null;
  versionOk =
    lib.assertMsg (!checkKitstartVersion || lockedKitstart == libKitstart)
      "mkLanding: package-lock.json has @evinvest/kitstart ${toString lockedKitstart}, this lib flake revision is ${libKitstart} — pin the flake to the tag @evinvest/kitstart-v${toString lockedKitstart}";

  # ── the hermetic build ──────────────────────────────────────────────────
  # `importNpmLock` fetches each package by the `integrity` package-lock.json
  # already pins: no second hash to keep in step, nothing else on the network.
  npmOs = if pkgs.stdenv.hostPlatform.isDarwin then "darwin" else "linux";
  npmCpu = if pkgs.stdenv.hostPlatform.isAarch64 then "arm64" else "x64";
  # npm's `os`/`cpu`/`libc`: a list of names, or of `!name` exclusions.
  fits =
    want: list:
    let
      positive = builtins.filter (x: !(lib.hasPrefix "!" x)) list;
    in
    !(builtins.elem "!${want}" list) && (positive == [ ] || builtins.elem want positive);
  foreign = m: (m ? os && !(fits npmOs m.os)) || (m ? cpu && !(fits npmCpu m.cpu)) || (m ? libc && !(fits "glibc" m.libc));
  # Every platform's native binary is in the lockfile — @next/swc alone is
  # ~100 MB each. npm skips the foreign ones without reading them, so they are
  # never fetched either.
  npmSourceOverrides = lib.concatMapAttrs
    (
      path: m: if (m.optional or false) && foreign m then { ${path} = pkgs.emptyFile; } else { }
    )
    (npmLock.packages or { });

  src = lib.fileset.toSource {
    inherit root;
    fileset = lib.fileset.unions (map (p: root + "/${p}") buildFiles);
  };
  # The dependencies hang on the manifest and the lock only, so a source edit
  # does not re-fetch them.
  npmRoot = lib.fileset.toSource {
    inherit root;
    fileset = lib.fileset.unions [ (root + "/package.json") (root + "/package-lock.json") ];
  };

  # `.next/standalone` plus the static chunks `postbuild` copies into it: the
  # server and only the files it was traced to need. The diagnostics ride
  # along for the bundle-budget check; nothing serves them.
  site =
    assert versionOk;
    pkgs.buildNpmPackage {
      inherit pname version src nodejs;
      npmDeps = pkgs.importNpmLock {
        inherit npmRoot;
        packageSourceOverrides = npmSourceOverrides // packageSourceOverrides;
      };
      npmConfigHook = pkgs.importNpmLock.npmConfigHook;
      env.NEXT_TELEMETRY_DISABLED = "1";
      installPhase = ''
        runHook preInstall
        test -f .next/standalone/server.js
        test -d .next/standalone/.next/static
        ${lib.concatMapStrings (f: "test -e ${lib.escapeShellArg ".next/standalone/${f}"}\n") requiredFiles}
        cp -a .next/standalone "$out"
        cp -a .next/diagnostics "$out/.next/diagnostics"
        runHook postInstall
      '';
      # The traced node_modules keep their bin shebangs; rewritten, each would
      # pull the full nodejs, npm included, into the image. Nothing runs them.
      dontPatchShebangs = true;
    };

  # ── the one hard gate ──────────────────────────────────────────────────
  # First-load JS of a place page against the brand's committed budget, on
  # the hermetic build: `nix flake check` fails over budget. The lib's own
  # copy of `kitstart-size`, run from source with type stripping.
  sizeCli = ../ts/kitstart/src/cli;
  sizeCmd = root: ''node --experimental-strip-types --disable-warning=ExperimentalWarning ${sizeCli}/kitstart-size.ts ${root} --route ${lib.escapeShellArg gatedRoute} --budget ${lib.escapeShellArg budgetFile}'';
  bundleBudget =
    pkgs.runCommand "${pname}-bundle-budget"
      {
        nativeBuildInputs = [ nodejs ];
        budget = lib.fileset.toSource {
          inherit root;
          fileset = root + "/${budgetFile}";
        };
      }
      ''
        cd "$budget"
        ${sizeCmd site}
        touch "$out"
      '';

  # ── the image ──────────────────────────────────────────────────────────
  dataDir = if mounts == [ ] then "/tmp" else builtins.head mounts;
  containerStd =
    if v_flakes == null then
      null
    else
      v_flakes.container.implement {
        inherit pkgs pname;
        containers."" = {
          port = lib.toInt sitePort;
          inherit mounts criticality;
          healthPath = "/health";
          entrypoint = [
            "${nodeRuntime}/bin/node"
            "${site}/server.js"
          ];
          workingDir = dataDir;
          imageEnv = [ "HOME=${dataDir}" ] ++ lib.mapAttrsToList (n: v: "${n}=${v}") prodEnv;
        };
      };

  # ── apps ───────────────────────────────────────────────────────────────
  # Resolve the repo at run time (`git rev-parse`), never `root`: that is the
  # read-only store snapshot, where npm cannot write. `npm ci` wipes
  # node_modules, so it runs only when the lockfile moved.
  ensureDeps = ''
    stamp="node_modules/.${pname}-lock"
    want="$(sha256sum package-lock.json | cut -d' ' -f1)"
    if [ "$(cat "$stamp" 2>/dev/null)" != "$want" ]; then
      npm ci
      echo "$want" > "$stamp"
    fi
  '';
  # The e2e specs' `@playwright/test` is the flake's, pinned with its browsers
  # (the pin is what makes a screenshot render alike on every machine of one
  # OS); linked where tsc and the config resolve it from.
  linkPlaywright = ''
    ln -sfn ${pkgs.playwright-test}/lib/node_modules ${lib.escapeShellArg e2eConfig}/node_modules
  '';
  playwrightEnv = {
    PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
  };
  exportPlaywright = lib.concatStrings (lib.mapAttrsToList (n: v: "export ${n}=${lib.escapeShellArg v}\n") playwrightEnv);

  app = name: drv: {
    type = "app";
    program = "${drv}/bin/${name}";
  };

  runDev = pkgs.writeShellApplication {
    name = "${pname}-dev";
    runtimeInputs = [ nodejs pkgs.git pkgs.coreutils ];
    text = ''
      cd "$(git rev-parse --show-toplevel)"
      ${ensureDeps}
      exec npm run dev -- --port ${sitePort}
    '';
  };

  runSize = pkgs.writeShellApplication {
    name = "${pname}-size";
    runtimeInputs = [ nodejs pkgs.git pkgs.coreutils ];
    text = ''
      cd "$(git rev-parse --show-toplevel)"
      ${ensureDeps}
      npm run -s build >/dev/null
      exec ${sizeCmd "."}
    '';
  };

  runTest = pkgs.writeShellApplication {
    name = "${pname}-test";
    runtimeInputs = [ nodejs pkgs.git pkgs.coreutils pkgs.playwright-test ];
    text = ''
      cd "$(git rev-parse --show-toplevel)"
      ${ensureDeps}
      ${linkPlaywright}
      ${exportPlaywright}
      echo "▶ tsc";    npm run -s typecheck
      echo "▶ lint";   npm run -s lint
      echo "▶ vitest"; npx vitest run
      echo "▶ build";  npm run -s build >/dev/null
      echo "▶ size";   ${sizeCmd "."}
      echo "▶ playwright"
      playwright test -c ${lib.escapeShellArg e2eConfig} "$@"
    '';
  };

  # Screenshot baselines are Linux's (CI's); a mac shoots different glyphs.
  runAcceptTest = pkgs.writeShellApplication {
    name = "${pname}-accept-test";
    runtimeInputs = [ nodejs pkgs.git pkgs.coreutils pkgs.playwright-test ];
    text = ''
      if [ "$(uname -s)" != Linux ]; then
        echo "✘ baselines are Linux's. Take them from CI instead." >&2
        exit 1
      fi
      cd "$(git rev-parse --show-toplevel)"
      ${ensureDeps}
      ${linkPlaywright}
      ${exportPlaywright}
      npm run -s build >/dev/null
      filter="''${1:-}"
      playwright test -c ${lib.escapeShellArg e2eConfig} --update-snapshots=all ''${filter:+-g "$filter"}
    '';
  };

  quoteFields = lib.concatStringsSep "\n" (lib.mapAttrsToList (n: v: "${n}=${v}") (smoke.quote or { }));
  containerSmoke = pkgs.writeShellApplication {
    name = "${pname}-container-smoke";
    runtimeInputs = [ pkgs.git pkgs.coreutils pkgs.curl pkgs.gnused pkgs.findutils ];
    runtimeEnv = {
      SMOKE_IMAGE_ATTR = containerAttr;
      SMOKE_IMAGE_NAME = "${pname}:latest";
      SMOKE_PORT = sitePort;
      SMOKE_HOST = smoke.host or "";
      SMOKE_PAGE = smoke.page or "/fr";
      SMOKE_OG = smoke.og or "/og";
      SMOKE_QUOTE = quoteFields;
      SMOKE_DATA = dataDir;
      # The no-env run blanks every one of these: a server that boots without
      # them would be one that writes leads outside the volume.
      # (Not the listening address: that is wiring, not the contract.)
      SMOKE_PROD_ENV_KEYS = lib.concatStringsSep " " (lib.subtractLists [ "PORT" "HOSTNAME" ] (builtins.attrNames prodEnv));
    };
    text = builtins.readFile ./container-smoke.sh;
  };

  help = pkgs.writeShellApplication {
    name = "${pname}-help";
    text = ''
      cat <<'EOF'
        nix run .#dev              next dev on ${sitePort}
        nix run .#test             tsc, lint, vitest, build, size, playwright
        nix run .#accept-test      accept screenshot baselines (Linux only); `-- <name>` for a subset
        nix run .#size             build, then the first-load JS budget   [the one hard gate]
        nix run .#container-smoke  boot the image and hold it to its contract (Linux + docker)
        nix build                  the standalone server
        nix build .#container      the OCI image (Linux)
        nix flake check            the hermetic build + the bundle budget against it
      EOF
    '';
  };
in
{
  inherit site bundleBudget;

  packages = {
    default = site;
    inherit site;
  }
  // lib.optionalAttrs (containerStd != null) (
    containerStd.packages // { container = containerStd.packages."${pname}-container"; }
  );

  containers = if containerStd == null then { } else containerStd.containers;

  checks = {
    inherit site;
    bundle-budget = bundleBudget;
  };

  apps = {
    default = app "${pname}-help" help;
    help = app "${pname}-help" help;
    dev = app "${pname}-dev" runDev;
    test = app "${pname}-test" runTest;
    accept-test = app "${pname}-accept-test" runAcceptTest;
    size = app "${pname}-size" runSize;
    container-smoke = app "${pname}-container-smoke" containerSmoke;
  };

  devShell = pkgs.mkShell {
    packages = [
      nodejs
      # runner + nixpkgs-pinned browsers; `apps.test` links it for tsc.
      pkgs.playwright-test
      pkgs.sqlite # inspecting the lead store
    ];
    env = playwrightEnv // {
      PORT = sitePort;
      NEXT_TELEMETRY_DISABLED = "1";
    };
  };
}
