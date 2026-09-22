#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";

import { brandFromToml, PaletteError, renderPalette } from "./brand";
import { readContract } from "./contract";

const USAGE = `usage: evinvest-palette --brand <slug> [--out <file.css>] <brand.toml>

Writes the brand's palette as a flat sheet scoped to [data-brand="<slug>"],
after checking both polarities against the contract in @evinvest/uikit's
styles/theme.css. Prints to stdout without --out.`;

function main(): number {
  const { values, positionals } = parseArgs({
    options: { brand: { type: "string" }, out: { type: "string" }, help: { type: "boolean", short: "h" } },
    allowPositionals: true,
  });
  const [input] = positionals;
  if (values.help || !values.brand || !input || positionals.length > 1) {
    console.error(USAGE);
    return values.help ? 0 : 2;
  }

  // Shipped beside `dist/`, so the contract is always the installed kit's own.
  const contract = readContract(readFileSync(new URL("../styles/theme.css", import.meta.url), "utf8"));
  const sheet = renderPalette(values.brand, brandFromToml(readFileSync(input, "utf8")), contract, basename(input));
  if (values.out) writeFileSync(values.out, sheet);
  else process.stdout.write(sheet);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  // A bad brand file is the user's input, not a crash: the message, no stack.
  if (error instanceof PaletteError) console.error(error.message);
  else throw error;
  process.exitCode = 1;
}
