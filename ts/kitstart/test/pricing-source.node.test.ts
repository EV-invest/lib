import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineSite, parsePricingModel, type PricingModel } from "../src/index";
import { createPricingSource } from "../src/server/index";
import { fixtureSite } from "./support/fixtures";

const model = (file: string): unknown => JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/pricing", file), "utf8"));
const BAKED = parsePricingModel(model("valid/cleaning.json"));
const LIVE: PricingModel = { ...BAKED, validFrom: "2026-11-01", minimumCents: 5900 };

const plain = fixtureSite("cleaning");
const site = defineSite({ ...plain, lead: { ...plain.lead, subjects: ["standard", "windows", "deep"], flows: { standard: "estimate", windows: "fixed" } }, pricing: BAKED });
const log = { error: vi.fn() };
const source = (base: string | null = "https://panel.example/api/internal/brands/vifnet", over = site) => createPricingSource(over, { baseUrl: () => base, log });

afterEach(() => {
  vi.unstubAllGlobals();
  log.error.mockReset();
});

describe("the live price list", () => {
  it("is the source's whole model, asked for with a TTL and a timeout", async () => {
    const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => Response.json(LIVE));
    vi.stubGlobal("fetch", fetch);
    expect(await source().model()).toEqual(LIVE);
    expect(String(fetch.mock.calls[0]?.[0])).toBe("https://panel.example/api/internal/brands/vifnet/pricing");
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ cache: "force-cache", next: { revalidate: 600 } });
    expect(fetch.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("is the baked model when the source has nothing set ({}), quietly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({})));
    expect(await source().model()).toBe(BAKED);
    expect(log.error).not.toHaveBeenCalled();
  });

  it.each([
    ["unreachable", async () => Promise.reject(new TypeError("fetch failed"))],
    ["a 500", async () => new Response(null, { status: 500 })],
    ["a 404", async () => Response.json({}, { status: 404 })],
    ["not JSON", async () => new Response("<html>", { status: 200 })],
    ["a model that does not validate", async () => Response.json({ ...LIVE, roundToCents: 0 })],
    ["half a model", async () => Response.json({ ...LIVE, needs: undefined })],
    ["a model missing a locale's labels", async () => Response.json(model("valid/at-the-cap.json"))],
    ["a list", async () => Response.json([])],
  ])("is the baked model, whole, when the source is %s", async (_, answer) => {
    vi.stubGlobal("fetch", vi.fn(answer));
    expect(await source().model()).toBe(BAKED);
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  it("asks nothing without a source", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await source(null).model()).toBe(BAKED);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("is nothing — every need a quote — for a brand with no baked model and no source", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    expect(await source(undefined, plain).model()).toBeNull();
    expect(await source(null, plain).model()).toBeNull();
  });
});

describe("defineSite", () => {
  it("refuses a baked model that would not validate, or lacks a locale's labels", () => {
    expect(() => defineSite({ ...plain, pricing: { ...BAKED, roundToCents: 0 } })).toThrow(/pricing: model.roundToCents/);
    expect(() => defineSite({ ...plain, pricing: parsePricingModel(model("valid/at-the-cap.json")) })).toThrow(/no "fr" label/);
  });

  it("refuses a flow for a need the form does not offer", () => {
    expect(() => defineSite({ ...plain, lead: { ...plain.lead, flows: { standard: "estimate" } } })).toThrow(/lead.flows names "standard"/);
  });
});
