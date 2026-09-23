# The prod environment of the server, baked into the image as plain env
# (flake.nix: `prodEnv`). Secret-free: SMTP_URL, SMS_TOKEN and POSTHOG_KEY
# (and LEAD_NOTIFY_TO/FROM, LOCATIONS_API_URL when used) arrive from the
# container environment a Secret injects.
#
# Explicit because the defaults are dev's: without HOSTNAME the standalone
# server binds one interface the readiness probe may not reach; without
# LEADS_DB_PATH or TRUSTED_PROXY the server refuses to start in production
# (instrumentation.ts), so the pod never turns ready rather than losing a lead
# or counting the wrong address against the rate limit.
{ port }:
{
  # The mount, not $HOME. Leads are the only durable state this service has.
  LEADS_DB_PATH = "/data/leads.db";
  # "cloudflare" is right only when the origin cannot be reached around the
  # tunnel (no public port, no ingress of its own): then CF-Connecting-IP is
  # the visitor. If anything else can reach the pod, a client could write that
  # header itself — use "xff:<n>" for the n proxies of yours in front instead.
  TRUSTED_PROXY = "cloudflare";
  HOSTNAME = "0.0.0.0";
  PORT = toString port;
  NODE_ENV = "production";
  NEXT_TELEMETRY_DISABLED = "1";
}
