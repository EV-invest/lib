import { describe, expect, it } from "vitest";
import { clientKey } from "../src/server/index";

const h = (init: Record<string, string>) => new Headers(init);

describe("the rate limit's client key", () => {
  it("trusts Cloudflare's address first — the origin is only reachable through the tunnel", () => {
    expect(clientKey(h({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1, 10.0.0.2" }))).toBe("203.0.113.7");
  });

  it("takes the right-most forwarded hop, never the one the client wrote", () => {
    expect(clientKey(h({ "x-forwarded-for": "6.6.6.6, 198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientKey(h({ "x-forwarded-for": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("falls back to one shared bucket rather than one per forged header", () => {
    expect(clientKey(h({}))).toBe("no-client-address");
    expect(clientKey(h({ "x-forwarded-for": " , " }))).toBe("no-client-address");
  });
});
