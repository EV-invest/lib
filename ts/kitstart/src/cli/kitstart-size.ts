#!/usr/bin/env node
// kitstart-size [<build root>] [--route /[locale]/[location]] [--budget tests/bundle_budget.txt]
// — the first-load JS of a place page against the brand's budget. See `size.ts`.
import { measure, parseArgs } from "./size";

try {
  process.exitCode = measure(parseArgs(process.argv.slice(2), process.cwd()));
} catch (error) {
  console.error(`✘ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
