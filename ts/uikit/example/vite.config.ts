import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { brandFromToml, readContract, renderPalette } from "../src/palette";

// Consume the kit straight from local source (../src) so editing a component is
// live here without a publish/build step. `dedupe` keeps a single React copy
// across the package boundary (two Reacts => "invalid hook call").
const uikitSrc = fileURLToPath(new URL("../src/index.ts", import.meta.url));

const PALETTES = "virtual:brand-palettes.css";
const tokens = fileURLToPath(new URL("../styles/tokens.css", import.meta.url));
const demoBrand = fileURLToPath(new URL("../test/fixtures/aquafix-demo.brand.toml", import.meta.url));

// The second brand's palette, generated the way a consumer would (the
// `evinvest-palette` bin) but in memory, so the example never holds a copy of
// generated CSS that could drift from the fixture the tests measure.
function brandPalettes(): Plugin {
  const resolved = `\0${PALETTES}`;
  return {
    name: "brand-palettes",
    resolveId: (id) => (id === PALETTES ? resolved : undefined),
    load(id) {
      if (id !== resolved) return undefined;
      this.addWatchFile(tokens);
      this.addWatchFile(demoBrand);
      const contract = readContract(readFileSync(tokens, "utf8"));
      return renderPalette("aquafix-demo", brandFromToml(readFileSync(demoBrand, "utf8")), contract, "aquafix-demo.brand.toml");
    },
  };
}

export default defineConfig({
  plugins: [brandPalettes(), react(), tailwindcss()],
  resolve: {
    alias: { "@evinvest/uikit": uikitSrc },
    dedupe: ["react", "react-dom"],
  },
});
