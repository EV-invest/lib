# Visual regression

One PNG per uikit primitive, in `__screenshots__/`, compared **byte for byte**.

```sh
nix run .#visual              # capture and compare — exit 0 means identical
nix run .#visual -- --update  # accept the current render as the baseline
```

Adding a primitive is still one line in `../support/gallery.rs`; the page list
flows from there through `dist/manifest.json` into the spec.

## Why it is shaped this way

```
  what moves the render?

  re-run, same machine ........... 0 px          deterministic
  x86_64-linux vs aarch64-linux .. 0 px          CPU arch is irrelevant
  host fonts vs pinned fonts ..... 0.03–0.21 %   real
  host fonts vs no Inter ......... 0.12–0.38 %   real
  linux vs darwin ................ > 1 %         cannot be fixed in-process
```

The OS matters and the CPU does not, so the capture is always a `*-linux`
derivation (`packages.visual-snapshots`) no matter who runs it. A mac routes it
to a **native** `aarch64-linux` builder VM and still matches these x86_64
baselines — no Docker, no Rosetta, no emulation.

Everything the render reads is pinned in the `visual` block of `flake.nix`:
runner and browsers from one nixpkgs (`playwright-test` carries its own browser
revision, so they cannot drift apart), the font set, and the Tailwind browser
engine — served out of `dist/` rather than a CDN, because the derivation builds
with no network.

There is no diff-ratio threshold. The render is deterministic once the inputs
are pinned, so a threshold is not slack that absorbs noise — it is a window the
baselines can drift through. The last one was 1 %, and the host font set moved
inside it unnoticed.

`dist/` is generated on the host, outside the derivation, so nothing here needs
cargo vendoring. If that ever made the HTML host-dependent, it would show up as
a snapshot diff — which is what the suite is for.

## macOS

A mac has two ways to refresh the baselines. Both end in the same place — the
capture is the `*-linux` derivation either way.

**Through CI (no local builder needed).** `.github/workflows/visual-baselines.yml`
renders the suite on the same ubuntu image the gate uses and publishes the PNGs
as the `visual-snapshots` artifact. It runs on every pull request that touches
`rust/`, the token/motion CSS or the flake, and on `workflow_dispatch`:

```sh
gh run list --workflow "Visual baselines" --branch "$(git branch --show-current)"
gh run download <run-id> -n visual-snapshots -D rust/tests/visual/__screenshots__
git add rust/tests/visual/__screenshots__ && git commit -m "test(uikit): refresh visual baselines (run <run-id>)"
```

Put the run id in the commit message: it is the provenance of the bytes. The
gate job (`nix run .#visual` in `errors.yml`) then confirms them on the next
push. This workflow is hand-written, not produced by the `github` block in
`flake.nix` — the generator only overwrites its own fixed file names
(`errors.yml`, `warnings.yml`, `claude*.yml`, `release-*.yml`, …), so it stays.

**With a linux builder.** In nix-darwin:

```nix
nix.linux-builder.enable = true;   # defaults to the host's arch → aarch64-linux
nix.settings.trusted-users = [ "@admin" ];
```

Without nix-darwin, run `nix run nixpkgs#darwin.linux-builder` and register it in
`nix.buildMachines`. Then `nix run .#visual -- --update` works as on linux.

The guest has its **own** store (`nix-builder-vm.nix` sets
`useNixStoreImage = true`), so it fetches the browser closure once from
substituters rather than reusing the host's.

## Not covered

Nothing here stops a stale baseline being committed — it only makes a stale one
detectable. Catching it at merge is the `nix run .#visual` job in
`.github/workflows/errors.yml` (the `flake-app` entry in the `github` block of
`flake.nix`): an ubuntu runner is byte-compatible with these baselines for free.
