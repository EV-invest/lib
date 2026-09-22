/**
 * PostHog Cloud region. A project lives in exactly one; events sent to the
 * other region's host are rejected, so the choice is part of the project's
 * identity rather than a tuning knob.
 */
export type PostHogRegion = "us" | "eu";

/**
 * Where events go: a PostHog Cloud `region`, or an explicit `host` (a reverse
 * proxy, a self-hosted instance). Exactly one of the two.
 */
export type PostHogTarget =
  | { region: PostHogRegion; host?: never }
  | { host: string; region?: never };

/** Ingestion host per PostHog Cloud region. */
export const POSTHOG_HOSTS: Readonly<Record<PostHogRegion, string>> = {
  us: "https://us.i.posthog.com",
  eu: "https://eu.i.posthog.com",
};

/**
 * The host the pre-existing entry points fall back to when neither a host nor a
 * region is given. Kept at US because the projects already consuming this
 * package (banking, site_conductor) are US-region; moving the fallback would
 * silently send their events to a region that rejects them. New entry points
 * (cookieless mode, {@link createBeaconSink}) require an explicit target
 * instead of inheriting this.
 */
export const LEGACY_DEFAULT_HOST = POSTHOG_HOSTS.us;

/**
 * Resolves an optional host/region pair to an ingestion host: `host` wins,
 * then `region`, then `fallback`.
 */
export function resolveHost(
  target: { host?: string | undefined; region?: PostHogRegion | undefined },
  fallback: string,
): string {
  if (target.host) return target.host;
  if (target.region) return POSTHOG_HOSTS[target.region];
  return fallback;
}
