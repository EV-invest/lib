import { afterEach, describe, expect, it, vi } from "vitest";
import { createExperimentsSource, parseExperimentOverrides } from "../src/server/index";

const BASE = "https://panel.example/api/internal/brands/vifnet";
const log = { error: vi.fn() };
let clock = 0;
const source = (base: string | null = BASE) => createExperimentsSource({ baseUrl: () => base, ttlMs: 1_000, now: () => clock, log });
const answer = (experiments: unknown) => Response.json({ experiments });

afterEach(() => {
  vi.unstubAllGlobals();
  log.error.mockReset();
  clock = 0;
});

describe("the experiments source", () => {
  it("asks the panel once, with a timeout and no Next cache", async () => {
    const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => answer({ hero: { enabled: false, weights: [1, 3], holdout: 0.1 } }));
    vi.stubGlobal("fetch", fetch);
    expect(await source().overrides()).toEqual({ hero: { enabled: false, weights: [1, 3], holdout: 0.1 } });
    expect(String(fetch.mock.calls[0]?.[0])).toBe(`${BASE}/experiments`);
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store" });
    expect(fetch.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("serves from memory within the TTL", async () => {
    const fetch = vi.fn(async () => answer({ hero: { enabled: false } }));
    vi.stubGlobal("fetch", fetch);
    const s = source();
    await s.overrides();
    clock = 999;
    expect(await s.overrides()).toEqual({ hero: { enabled: false } });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("past the TTL, answers stale at once and refreshes behind it", async () => {
    let release: (r: Response) => void = () => undefined;
    const fetch = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(answer({ hero: { enabled: false } }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => (release = resolve)));
    vi.stubGlobal("fetch", fetch);
    const s = source();
    await s.overrides();
    clock = 1_000;
    // The refresh hangs: the answer must not wait for it.
    expect(await s.overrides()).toEqual({ hero: { enabled: false } });
    expect(await s.overrides()).toEqual({ hero: { enabled: false } });
    expect(fetch).toHaveBeenCalledTimes(2);
    release(answer({ hero: { enabled: true } }));
    await vi.waitFor(async () => expect(await s.overrides()).toEqual({ hero: { enabled: true } }));
  });

  it("sends one request for visitors arriving together on a cold start", async () => {
    const fetch = vi.fn(async () => answer({}));
    vi.stubGlobal("fetch", fetch);
    const s = source();
    await Promise.all([s.overrides(), s.overrides(), s.overrides()]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("has no overrides and asks nothing without a base URL", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await source(null).overrides()).toEqual({});
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["unreachable", async () => Promise.reject(new TypeError("fetch failed"))],
    ["a timeout", async () => Promise.reject(new DOMException("timed out", "TimeoutError"))],
    ["a 500", async () => new Response(null, { status: 500 })],
    ["a 204", async () => new Response(null, { status: 204 })],
    ["not JSON", async () => new Response("<html>", { status: 200 })],
    ["not the panel's shape", async () => Response.json({ hero: { enabled: false } })],
    ["experiments that are not an object", async () => answer([{ enabled: false }])],
  ])("is {} and logs when the panel is %s", async (_, respond) => {
    vi.stubGlobal("fetch", vi.fn(respond));
    expect(await source().overrides()).toEqual({});
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a 503", async () => new Response(null, { status: 503 })],
    ["unreachable", async () => Promise.reject(new TypeError("fetch failed"))],
    ["not the panel's shape", async () => Response.json({ nope: true })],
  ])("keeps the last good overrides when a refresh fails (%s): a kill switch stays off", async (_, failure) => {
    const fetch = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(answer({ hero: { enabled: false } }))
      .mockImplementationOnce(failure)
      .mockResolvedValueOnce(answer({ hero: { enabled: true } }));
    vi.stubGlobal("fetch", fetch);
    const s = source();
    await s.overrides();
    clock = 1_000;
    await s.overrides();
    await vi.waitFor(() => expect(log.error).toHaveBeenCalledTimes(1));
    expect(await s.overrides()).toEqual({ hero: { enabled: false } });
    expect(fetch).toHaveBeenCalledTimes(2);
    // Recovered panel: the next refresh after the TTL takes its answer.
    clock = 2_000;
    await s.overrides();
    await vi.waitFor(async () => expect(await s.overrides()).toEqual({ hero: { enabled: true } }));
  });

  it("does not ask again until the TTL after a failure", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    const s = source();
    await s.overrides();
    clock = 500;
    await s.overrides();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("parseExperimentOverrides", () => {
  it("keeps fields of the right type and drops the rest", () => {
    expect(
      parseExperimentOverrides({
        experiments: {
          a: { enabled: "no", weights: [1, "2"], holdout: 0.2 },
          b: { weights: [0, 1], extra: true },
          c: null,
          d: 3,
        },
      }),
    ).toEqual({ a: { holdout: 0.2 }, b: { weights: [0, 1] } });
  });

  it("is {} for the panel's empty answer and null for anything else", () => {
    expect(parseExperimentOverrides({ experiments: {} })).toEqual({});
    for (const body of [null, [], "x", {}, { experiments: null }, { experiments: [] }]) expect(parseExperimentOverrides(body)).toBeNull();
  });
});
