import { readFileSync } from "node:fs";
import { describeLandingContract } from "@evinvest/kitstart/testing";
import { describe, expect, it } from "vitest";
import { TEXT } from "@/entities/content";
import { OWNER_TODO, site } from "@/shared/config/site";

describeLandingContract(site, {
  globalsCss: readFileSync("app/globals.css", "utf8"),
  proxySource: readFileSync("proxy.ts", "utf8"),
  text: TEXT,
});

describe("launch", () => {
  // A domain in card.toml is the launch; the owner's blocking facts must be in first.
  it("is refused while a blocking owner fact is open", () => {
    const open = OWNER_TODO.filter(t => t.blocksLaunch).map(t => t.field);
    if (site.brand.domain !== null) expect(open).toEqual([]);
  });
});
