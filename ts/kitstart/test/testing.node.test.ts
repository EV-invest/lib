import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROXY_MATCHER } from "../src/proxy/index";
import { describeLandingContract, describeLeadStoreContract, servedPaths, serviceAreaPlace, storefrontPlace, testLead } from "../src/testing/index";
import type { LeadStore } from "../src/index";
import { fixtureSite } from "./support/fixtures";

/** A brand's directory with these files (empty ones do). */
function brandTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "kitstart-brand-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

// The suites a brand runs, run here on both shared sites, so a contract that
// no valid site can pass fails in this package first.
describeLandingContract(fixtureSite("aquafix"), {
  globalsCss: '@import "tailwindcss";\n@source "../node_modules/@evinvest/kitstart/dist";\n',
  proxySource: `export const config = { matcher: [${JSON.stringify(PROXY_MATCHER)}] };`,
  text: { fr: {}, en: {} },
});
describeLandingContract(fixtureSite("cleaning"), { mustPublish: ["paris"], root: brandTree({ "app/icon.svg": "", "public/favicon.ico": "" }) });
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

describe("servedPaths", () => {
  it("reads the routes outside [locale], the root metadata files and public/, and nothing else", () => {
    const root = brandTree({
      "app/[locale]/page.tsx": "",
      "app/(marketing)/x/page.tsx": "",
      "app/og/route.tsx": "",
      "app/robots.ts": "",
      "app/sitemap.ts": "",
      "app/icon.svg": "",
      "app/apple-icon.tsx": "",
      "app/globals.css": "",
      "app/global-not-found.tsx": "",
      "public/fonts/inter.woff2": "",
    });
    expect(servedPaths(root)).toEqual(["/apple-icon", "/fonts/inter.woff2", "/icon.svg", "/og", "/robots.txt", "/sitemap.xml"]);
    expect(servedPaths(brandTree({}))).toEqual([]);
  });
});

describe("the fixtures", () => {
  it("come in both shapes, in every locale asked for", () => {
    expect(storefrontPlace(["fr", "en"]).name).toEqual({ fr: "Royat", en: "Royat" });
    expect(serviceAreaPlace(["fr"], { slug: "lyon" })).toMatchObject({ slug: "lyon", presence: { kind: "service-area" } });
    expect(testLead({ placeSlug: "royat" })).toMatchObject({ placeSlug: "royat", spamVerdict: null });
  });
});
