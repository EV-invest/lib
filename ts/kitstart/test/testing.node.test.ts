import { describe, expect, it } from "vitest";
import { PROXY_MATCHER } from "../src/proxy/index";
import { describeLandingContract, describeLeadStoreContract, serviceAreaPlace, storefrontPlace, testLead } from "../src/testing/index";
import type { LeadStore } from "../src/index";
import { fixtureSite } from "./support/fixtures";

// The suites a brand runs, run here on both shared sites, so a contract that
// no valid site can pass fails in this package first.
describeLandingContract(fixtureSite("aquafix"), {
  globalsCss: '@import "tailwindcss";\n@source "../node_modules/@evinvest/kitstart/dist";\n',
  proxySource: `export const config = { matcher: [${JSON.stringify(PROXY_MATCHER)}] };`,
  text: { fr: {}, en: {} },
});
describeLandingContract(fixtureSite("cleaning"), { mustPublish: ["paris"] });
describeLandingContract(fixtureSite("prelaunch"));

describeLeadStoreContract("in memory", () => {
  const rows: unknown[] = [];
  const store = (): LeadStore => ({
    insert: async lead => rows.push(lead),
    count: async () => rows.length,
    schemaVersion: async () => 4,
    health: async () => undefined,
    close: async () => undefined,
  });
  return { open: async () => ((rows.length = 0), store()) };
});

describe("the fixtures", () => {
  it("come in both shapes, in every locale asked for", () => {
    expect(storefrontPlace(["fr", "en"]).name).toEqual({ fr: "Royat", en: "Royat" });
    expect(serviceAreaPlace(["fr"], { slug: "lyon" })).toMatchObject({ slug: "lyon", presence: { kind: "service-area" } });
    expect(testLead({ placeSlug: "royat" })).toMatchObject({ placeSlug: "royat", spamVerdict: null });
  });
});
