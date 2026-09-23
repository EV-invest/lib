import { afterEach, describe, expect, it, vi } from "vitest";
import { storefrontOf } from "../src/index";
import { createPlaceSource } from "../src/server/index";
import { fixtureSite } from "./support/fixtures";

const site = fixtureSite("aquafix");
const log = { error: vi.fn() };
const live = (base: string | null = "https://live.example") => createPlaceSource(site, { baseUrl: () => base, log });

afterEach(() => {
  vi.unstubAllGlobals();
  log.error.mockReset();
});

const bySlug = (answer: (slug: string) => Response | Promise<Response>) =>
  vi.fn(async (input: string | URL | Request) => answer(/\/locations\/([^?]+)/.exec(String(input))?.[1] ?? ""));

describe("one place from the live source", () => {
  it("merges live fields over the baked ones, asking with the locale and a TTL", async () => {
    const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => Response.json({ phone: "+33 4 11 11 11 11", serviceArea: ["Royat"] }));
    vi.stubGlobal("fetch", fetch);
    const place = await live().getPlace("royat", "en");
    expect(place?.channels.phone).toBe("+33 4 11 11 11 11");
    expect(place && storefrontOf(place)?.address.postalCode).toBe("63130");
    expect(String(fetch.mock.calls[0]?.[0])).toBe("https://live.example/locations/royat?locale=en");
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ cache: "force-cache", next: { revalidate: 600 } });
  });

  it("turns the source's own 404 (its JSON) or a 410 into a missing place", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "withdrawn" }, { status: 404 })));
    expect(await live().getPlace("royat", "fr")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 410 })));
    expect(await live().getPlace("royat", "fr")).toBeNull();
  });

  it("serves the baked place on a bare 404 — an ingress with no route is not the source retiring a place", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>404</html>", { status: 404, headers: { "content-type": "text/html" } })));
    expect((await live().getPlace("royat", "fr"))?.slug).toBe("royat");
  });

  // Under ISR a cold render that throws is a bare 500 with no phone on it.
  it("serves the baked place on a 5xx — never a soft 404, never a thrown render", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 502 })));
    const place = await live().getPlace("royat", "fr");
    expect(place?.slug).toBe("royat");
    expect(place?.hours).toBeNull();
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("502"));
  });

  it("serves the baked place when the source is unreachable or answers garbage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect((await live().getPlace("royat", "fr"))?.slug).toBe("royat");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 200 })));
    expect((await live().getPlace("royat", "fr"))?.slug).toBe("royat");
  });

  it("never asks about a place it does not have, and asks nothing without a source", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await live().getPlace("paris", "fr")).toBeNull();
    expect((await live(null).getPlace("royat", "fr"))?.slug).toBe("royat");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("every place", () => {
  it("keeps the sitemap strict on a dead or failing source", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    await expect(live().listPlaces("fr", "sitemap")).rejects.toThrow(/unreachable/);
    vi.stubGlobal("fetch", bySlug(s => new Response(null, { status: s === "royat" ? 503 : 200 })));
    await expect(live().listPlaces("fr", "sitemap")).rejects.toThrow(/503/);
  });

  it("lets a page stand on the baked places when the source is dead", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect(await live().listPlaces("fr", "page")).toHaveLength(6);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    expect(await live().listPlaces("fr", "page")).toHaveLength(6);
  });

  it("drops a place the source retired (404) in both modes", async () => {
    vi.stubGlobal("fetch", bySlug(s => (s === "royat" ? new Response(null, { status: 410 }) : Response.json({}))));
    for (const mode of ["page", "sitemap"] as const) {
      const slugs = (await live().listPlaces("fr", mode)).map(p => p.slug);
      expect(slugs).toHaveLength(5);
      expect(slugs).not.toContain("royat");
    }
  });
});
