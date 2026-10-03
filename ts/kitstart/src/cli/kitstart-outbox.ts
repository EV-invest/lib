#!/usr/bin/env node
// kitstart-outbox <status | requeue> [--db <leads.db>] — see `outbox.ts`.
import { runOutboxCli } from "./outbox.ts";

try {
  process.exitCode = runOutboxCli(process.argv.slice(2), process.env, line => console.log(line));
} catch (error) {
  console.error(`✘ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
