{
  inputs = {
    v_flakes.url = "github:valeratrades/v_flakes?ref=v1.6";
    # The lib flake at the tag of the @evinvest/kitstart version in
    # package-lock.json — mkLanding refuses a mismatch.
    ev.url = "github:EV-invest/lib?ref=@evinvest/kitstart-v0.3.0";
    ev.inputs.v_flakes.follows = "v_flakes";
  };

  outputs = { self, v_flakes, ev }:
    v_flakes.flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import v_flakes.default_nixpkgs { inherit system; };
        sitePort = "59082";
        landing = ev.lib.mkLanding {
          inherit pkgs v_flakes sitePort;
          root = ./.;
          pname = "brand-landing";
          buildFiles = [
            "package.json"
            "package-lock.json"
            "app"
            "src"
            "assets"
            "next.config.ts"
            "tsconfig.json"
            "postcss.config.mjs"
            "proxy.ts"
            "instrumentation.ts"
          ];
          prodEnv = import ./deploy/config.nix { port = sitePort; };
          requiredFiles = [ "assets/fonts/Inter-Regular.ttf" ];
          smoke = {
            page = "/fr";
            og = "/og?l=paris";
            quote = { location = "paris"; subject = "standard"; locality = "75011"; mobile = "0612345678"; };
          };
        };
      in
      {
        inherit (landing) packages checks apps containers;
        devShells.default = landing.devShell;
      }
    );
}
