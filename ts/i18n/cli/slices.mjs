#!/usr/bin/env node
import { runSlices } from "../dist/extract.js";

runSlices(process.argv.slice(2));
