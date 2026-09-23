import { describe, expect, it, vi } from "vitest";
import { createPlaceSource } from "../src/server/index";
import { fixtureSite } from "./support/fixtures";

let host = "";
vi.mock("next/headers.js", () => ({ headers: async () => new Headers({ host }) }));

const { robotsRoute, sitemapRoute } = await import("../src/next/routes");
const site = fixtureSite("aquafix");

describe("the sitemap and robots routes", () => {
  it("answer for the request's host", async () => {
    const sitemap = sitemapRoute(site, createPlaceSource(site, { baseUrl: () => null }));
    host = "aquafix.top";
    expect((await sitemap()).map(e => e.url)).toEqual(["https://aquafix.top/fr", "https://aquafix.top/en"]);
    expect((await robotsRoute(site)()).sitemap).toBe("https://aquafix.top/sitemap.xml");
    host = "royat.aquafix.top";
    expect(await sitemap()).toEqual([]);
    expect((await robotsRoute(site)()).sitemap).toBe("https://royat.aquafix.top/sitemap.xml");
  });

  it("fail, rather than shrink, when the live source is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    host = "royat.aquafix.top";
    await expect(sitemapRoute(site, createPlaceSource(site, { baseUrl: () => "https://live.example" }))()).rejects.toThrow(/unreachable/);
    vi.unstubAllGlobals();
  });
});
