import { defineConfig } from "tsup";

import { clientConfig, nextConfig } from "./tsup.config";

// Re-emits the entries that do not clean — the client ones and the Next
// helpers — after the main `tsup` run, so their declarations survive the race
// described in `tsup.config.ts`.
export default defineConfig([clientConfig, nextConfig]);
