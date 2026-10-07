#!/usr/bin/env node
import { runCheck, runCli } from "../dist/extract.js";

runCli("evinvest-i18n-check", () => runCheck(process.argv.slice(2)));
