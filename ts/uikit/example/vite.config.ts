import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Consume the kit straight from local source (../src) so editing a component is
// live here without a publish/build step. `dedupe` keeps a single React copy
// across the package boundary (two Reacts => "invalid hook call").
const uikitSrc = fileURLToPath(new URL("../src/index.ts", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@evinvest/uikit": uikitSrc },
    dedupe: ["react", "react-dom"],
  },
});
