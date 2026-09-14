#!/usr/bin/env node
import { runCheck } from "../dist/extract.js";

runCheck(process.argv.slice(2));
