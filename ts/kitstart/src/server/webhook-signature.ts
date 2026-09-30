import "server-only";
import { createHmac } from "node:crypto";

/**
 * How a signed webhook proves who sent it and when:
 *
 * ```text
 * <keyId header>:     the sender's key id
 * <timestamp header>: unix seconds at send time
 * <signature header>: hex(HMAC-SHA256(secret, prefix + timestamp + "." + body))
 * ```
 *
 * The timestamp is inside the MAC, so a captured request cannot be re-stamped
 * past the receiver's replay window. The prefix names what is signed, so a MAC
 * made with the same secret for anything else never passes for this. Prefix
 * and header names are the receiver's, and a brand passes them — the kit
 * knows no receiver, so it has no defaults to guess one by.
 */
export interface WebhookSigning {
  prefix: string;
  headers: WebhookSignatureHeaders;
}

export interface WebhookSignatureHeaders {
  keyId: string;
  timestamp: string;
  signature: string;
}

/** Lowercase hex, as the receiver compares it. */
export function signWebhook(secret: string, prefix: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(prefix).update(timestamp).update(".").update(body).digest("hex");
}

/** The three headers for one send; signed afresh each attempt, since the timestamp is. */
export function signatureHeaders(
  signing: WebhookSigning,
  key: { keyId: string; secret: string },
  body: string,
  nowMs: number,
): Record<string, string> {
  const names = signing.headers;
  const timestamp = String(Math.floor(nowMs / 1000));
  return {
    [names.keyId]: key.keyId,
    [names.timestamp]: timestamp,
    [names.signature]: signWebhook(key.secret, signing.prefix, timestamp, body),
  };
}
