import { describe, expect, it } from "vitest";
import { clientKey, parseProxyTrust, parseServerEnv } from "../src/server/index";

const h = (init: Record<string, string>) => new Headers(init);

describe("the rate limit's client key", () => {
  it("behind Cloudflare, takes CF-Connecting-IP and nothing else", () => {
    expect(clientKey(h({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1, 10.0.0.2" }), "cloudflare")).toBe("203.0.113.7");
    // A client-written X-Forwarded-For is not a fallback: it is forgeable.
    expect(clientKey(h({ "x-forwarded-for": "198.51.100.4" }), "cloudflare")).toBe("no-client-address");
  });

  it("behind n proxies of ours, takes the n-th hop from the right, never one the client wrote", () => {
    expect(clientKey(h({ "x-forwarded-for": "6.6.6.6, 198.51.100.4" }), { xffHops: 1 })).toBe("198.51.100.4");
    expect(clientKey(h({ "x-forwarded-for": "6.6.6.6, 198.51.100.4, 10.0.0.2" }), { xffHops: 2 })).toBe("198.51.100.4");
    expect(clientKey(h({ "x-forwarded-for": "10.0.0.2" }), { xffHops: 2 })).toBe("no-client-address");
  });

  it("falls back to one shared bucket rather than one per forged header", () => {
    expect(clientKey(h({}), { xffHops: 1 })).toBe("no-client-address");
    expect(clientKey(h({ "x-forwarded-for": " , " }), { xffHops: 1 })).toBe("no-client-address");
  });

  it("is read from TRUSTED_PROXY, and production refuses to guess", () => {
    expect(parseProxyTrust("cloudflare")).toBe("cloudflare");
    expect(parseProxyTrust("xff:2")).toEqual({ xffHops: 2 });
    expect(() => parseProxyTrust("xff:0")).toThrow(/TRUSTED_PROXY/);
    const site = { brand: { id: "b" } };
    expect(() => parseServerEnv(site, { NODE_ENV: "production", LEADS_DB_PATH: "/data/l.db" })).toThrow(/TRUSTED_PROXY is required/);
    expect(parseServerEnv(site, { NODE_ENV: "production", LEADS_DB_PATH: "/data/l.db", TRUSTED_PROXY: "cloudflare" }).trustedProxy).toBe("cloudflare");
  });
});
