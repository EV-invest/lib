#!/usr/bin/env node
import { runSlices, runCli } from "../dist/extract.js";

runCli("evinvest-i18n-slices", () => runSlices(process.argv.slice(2)));
