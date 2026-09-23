import "server-only";

/**
 * Which proxy's word the rate limit takes for the client's address — said
 * outright, because the wrong guess is either forgeable or useless:
 *
 * - `"cloudflare"`: the origin is reached only through Cloudflare (the
 *   cloudflared tunnel), so `CF-Connecting-IP` is the visitor and cannot be
 *   forged past the edge;
 * - `{ xffHops: n }`: `n` proxies of ours each append to `X-Forwarded-For`,
 *   so the visitor is the n-th entry from the right — everything left of it
 *   is whatever the client wrote.
 *
 * From `TRUSTED_PROXY` (`cloudflare` | `xff:<n>`); production refuses to boot
 * without it (`parseServerEnv`).
 */
export type ProxyTrust = "cloudflare" | { xffHops: number };

/** One shared bucket when the trusted header is absent: coarse, but it throttles rather than admits. */
export const NO_CLIENT_ADDRESS = "no-client-address";

export function parseProxyTrust(value: string): ProxyTrust {
  if (value === "cloudflare") return "cloudflare";
  const hops = /^xff:([1-9]\d?)$/.exec(value)?.[1];
  if (hops) return { xffHops: Number(hops) };
  throw new Error('TRUSTED_PROXY must be "cloudflare" or "xff:<n>" (n ≥ 1)');
}

export function clientKey(headers: Headers, trust: ProxyTrust): string {
  if (trust === "cloudflare") return headers.get("cf-connecting-ip")?.trim() || NO_CLIENT_ADDRESS;
  const hops = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map(h => h.trim())
    .filter(Boolean);
  return hops.at(-trust.xffHops) ?? NO_CLIENT_ADDRESS;
}
