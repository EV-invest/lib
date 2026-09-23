import { defineConfig } from "tsup";

import { clientConfig } from "./tsup.config";

// Re-emits ONLY the client entries, with `clean: false`, after the main `tsup`
// run — see the race described in `tsup.config.ts`.
export default defineConfig(clientConfig);
