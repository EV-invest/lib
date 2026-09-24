import { readFileSync } from "node:fs";
import { describeLandingContract } from "@evinvest/kitstart/testing";
import { TEXT } from "@/entities/content";
import { OWNER_TODO, site } from "@/shared/config/site";

// A domain in card.toml is the launch; `ownerTodo` refuses it while a
// blocking owner fact is open.
describeLandingContract(site, {
  globalsCss: readFileSync("app/globals.css", "utf8"),
  proxySource: readFileSync("proxy.ts", "utf8"),
  root: process.cwd(),
  text: TEXT,
  ownerTodo: OWNER_TODO,
});
