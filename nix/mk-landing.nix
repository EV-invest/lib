# `lib.mkLanding`: everything a landing's flake.nix shares, ported from the
# aquafix flake — the hermetic `next build` from package-lock.json, the OCI
# image, the bundle-budget check, the container smoke, and the dev/size apps.
# A brand's flake.nix then reads (per system):
#
#   landing = ev.lib.mkLanding {
#     inherit pkgs v_flakes;
#     root = ./.;
#     pname = "vifnet"; sitePort = "59082";
#     buildFiles = [ "package.json" "package-lock.json" "app" "src" "assets"
#                    "next.config.ts" "tsconfig.json" "postcss.config.mjs"
#                    "proxy.ts" "instrumentation.ts" ];
#     prodEnv = import ./deploy/config.nix { port = "59082"; };
#     smoke = { page = "/fr"; quote = { location = "paris"; subject = "standard"; locality = "75011"; mobile = "0612345678"; }; };
#   };
#   packages = landing.packages; checks = landing.checks; apps = landing.apps;
#
# The npm version of @evinvest/kitstart and the lib flake revision move in one
# PR: the size gate below runs the lib's copy of `kitstart-size`.
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
  # subdomains site) and, optionally, a form POST whose lead must land in /data.
  smoke ? { page = "/fr"; }
,
}:
let
  lib = pkgs.lib;
  manifest = lib.importJSON (root + "/package.json");
  version = manifest.version or "0.0.0";

  # ── the hermetic build ──────────────────────────────────────────────────
  # `importNpmLock` fetches each package by the `integrity` package-lock.json
  # already pins: no second hash to keep in step, nothing else on the network.
  npmLock = lib.importJSON (root + "/package-lock.json");
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

  # `.next/standalone` plus the static chunks `postbuild` copies into it: the
  # server and only the files it was traced to need. The diagnostics ride
  # along for the bundle-budget check; nothing serves them.
  site = pkgs.buildNpmPackage {
    inherit pname version src nodejs;
    npmDeps = pkgs.importNpmLock {
      npmRoot = src;
      packageSourceOverrides = npmSourceOverrides;
    };
    npmConfigHook = pkgs.importNpmLock.npmConfigHook;
    env.NEXT_TELEMETRY_DISABLED = "1";
    installPhase = ''
      runHook preInstall
      test -f .next/standalone/server.js
      test -d .next/standalone/.next/static
      ${lib.concatMapStrings (f: "test -e .next/standalone/${f}\n") requiredFiles}
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
  # the hermetic build: `nix flake check` fails over budget.
  sizeCli = ../ts/kitstart/src/cli;
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
        node --experimental-strip-types --disable-warning=ExperimentalWarning \
          ${sizeCli}/kitstart-size.ts ${site} --route '${gatedRoute}' --budget '${budgetFile}'
        touch "$out"
      '';

  # ── the image ──────────────────────────────────────────────────────────
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
          workingDir = builtins.head mounts;
          imageEnv = [ "HOME=${builtins.head mounts}" ] ++ lib.mapAttrsToList (n: v: "${n}=${v}") prodEnv;
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
      exec node --experimental-strip-types --disable-warning=ExperimentalWarning \
        ${sizeCli}/kitstart-size.ts --route '${gatedRoute}' --budget '${budgetFile}'
    '';
  };

  quoteFields = lib.concatStringsSep "\n" (lib.mapAttrsToList (n: v: "${n}=${v}") (smoke.quote or { }));

  containerSmoke = pkgs.writeShellApplication {
    name = "${pname}-container-smoke";
    runtimeInputs = [ pkgs.git pkgs.coreutils pkgs.curl ];
    text = ''
      cd "$(git rev-parse --show-toplevel)"
      SMOKE_IMAGE_NAME='${pname}:latest' \
      SMOKE_PORT='${sitePort}' \
      SMOKE_HOST='${smoke.host or ""}' \
      SMOKE_PAGE='${smoke.page or "/fr"}' \
      SMOKE_QUOTE=${lib.escapeShellArg quoteFields} \
        exec bash ${./container-smoke.sh}
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
    dev = {
      type = "app";
      program = "${runDev}/bin/${pname}-dev";
    };
    size = {
      type = "app";
      program = "${runSize}/bin/${pname}-size";
    };
    container-smoke = {
      type = "app";
      program = "${containerSmoke}/bin/${pname}-container-smoke";
    };
  };
}
