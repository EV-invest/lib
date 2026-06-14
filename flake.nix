{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/da5ad661ba4e5ef59ba743f0d112cbc30e474f32";
    flake-utils.url = "github:numtide/flake-utils/11707dc2f618dd54ca8739b309ec4fc024de578b";
    v_flakes.url = "github:valeratrades/v_flakes/6062f652effc94be053865d58ff03c697c31ecb6";
  };

  outputs = { self, nixpkgs, flake-utils, v_flakes }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            cargo
            rustc
            clippy
            rustfmt
            nodejs_22
          ];
          shellHook = ''
            cp -f ${(v_flakes.files.gitattributes { inherit pkgs; lfs = false; })} ./.gitattributes
            cp -f ${(v_flakes.files.gitignore {
              inherit pkgs;
              langs = [ "rs" ];
              # No JS/TS fragment ships with v_flakes; append node artifacts here.
              extra = "## Node / TypeScript\n**/node_modules/\n**/dist/\n**/*.tsbuildinfo";
            })} ./.gitignore
          '';
        };
      });
}
