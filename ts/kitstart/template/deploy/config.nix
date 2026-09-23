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
  # Reached only through Cloudflare (the cloudflared tunnel). Behind your own
  # ingress instead: "xff:1" (one proxy appending X-Forwarded-For).
  TRUSTED_PROXY = "cloudflare";
  HOSTNAME = "0.0.0.0";
  PORT = toString port;
  NODE_ENV = "production";
  NEXT_TELEMETRY_DISABLED = "1";
}
