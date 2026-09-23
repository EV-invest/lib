import "server-only";

/**
 * Who a submission counts against for the rate limit. The origin is reached
 * only through the cloudflared tunnel, so Cloudflare's `CF-Connecting-IP` is
 * the visitor and cannot be forged past the edge. Without it, the right-most
 * `X-Forwarded-For` entry — the one our own proxy appended, not the ones a
 * client wrote before it. The leftmost is whatever the bot chose to send.
 *
 * App Router route handlers expose no socket address, so the last resort is
 * one shared bucket: coarse, but it throttles rather than admits.
 */
export function clientKey(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const hops = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map(h => h.trim())
    .filter(Boolean);
  return hops.at(-1) ?? "no-client-address";
}
