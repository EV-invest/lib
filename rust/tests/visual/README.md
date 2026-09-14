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

## macOS prerequisite

A mac needs a linux builder once. In nix-darwin:

```nix
nix.linux-builder.enable = true;   # defaults to the host's arch → aarch64-linux
nix.settings.trusted-users = [ "@admin" ];
```

Without nix-darwin, run `nix run nixpkgs#darwin.linux-builder` and register it in
`nix.buildMachines`.

The guest has its **own** store (`nix-builder-vm.nix` sets
`useNixStoreImage = true`), so it fetches the browser closure once from
substituters rather than reusing the host's.

## Not covered

Nothing here stops a stale baseline being committed — it only makes a stale one
detectable by every dev. Catching it at merge needs CI, which this repo
deliberately does not run (see the `github` block in `flake.nix`). An ubuntu
runner would be byte-compatible with these baselines for free.
