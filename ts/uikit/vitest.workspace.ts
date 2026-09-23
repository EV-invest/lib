import { defineWorkspace } from "vitest/config";

// Two environments: the kit's DOM tests in jsdom, and `test/rsc/` under the
// `react-server` export condition — what a Next Server Component resolves
// `react` to — so a server-only render is exercised for real.
export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "dom",
      exclude: ["test/rsc/**", "**/node_modules/**", "example/**"],
    },
  },
  {
    extends: "./vitest.config.ts",
    resolve: { conditions: ["react-server"] },
    ssr: { resolve: { conditions: ["react-server"], externalConditions: ["react-server"] } },
    test: {
      name: "rsc",
      environment: "node",
      setupFiles: [],
      include: ["test/rsc/**/*.rsc.test.tsx"],
      // Externalised packages (react, the Flight server) are loaded by Node,
      // not Vite, so the condition has to be Node's too: `npm test` runs this
      // project with NODE_OPTIONS=--conditions=react-server.
    },
  },
]);
