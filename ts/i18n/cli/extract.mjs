#!/usr/bin/env node
import { runExtract, runCli } from "../dist/extract.js";

runCli("evinvest-i18n-extract", () => runExtract(process.argv.slice(2)));
