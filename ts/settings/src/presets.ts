/**
 * Org-canonical shared variable groups — one place that fixes the names, so
 * `POSTHOG_KEY` vs `POSTHOG_API_KEY` vs `NEXT_PUBLIC_POSTHOG_KEY` drift stops
 * at the source. Spread a preset into the `server` / `client` block of
 * {@link createSettings}; the Rust mirror ships the same server-side groups as
 * ready-made structs (`settings::presets`).
 */

import { optional, str, withDefault, type Validator } from './validators';

export const presets = {
  /**
   * PostHog capture credentials, canonical names: `POSTHOG_KEY` /
   * `POSTHOG_HOST`. Both optional — capture is simply off without them. The
   * project key (`phc_…`) is write-only and ships in frontend bundles anyway,
   * so it is not `secret(...)`.
   */
  posthog: (): { POSTHOG_KEY: Validator<string | undefined>; POSTHOG_HOST: Validator<string | undefined> } => ({
    POSTHOG_KEY: optional(str()),
    POSTHOG_HOST: optional(str()),
  }),

  /**
   * Sentry reporting, canonical name: `SENTRY_DSN`. Optional — monitoring is
   * off without it. A DSN authorises event *submission* only, so it is not
   * `secret(...)`.
   */
  sentry: (): { SENTRY_DSN: Validator<string | undefined> } => ({
    SENTRY_DSN: optional(str()),
  }),

  /**
   * The deployment environment, canonical name: `APP_ENV`. Defaults to
   * `development`; kept a free string on purpose — constraining the values
   * would break consumers that add a stage.
   */
  appEnv: (): { APP_ENV: Validator<string> } => ({
    APP_ENV: withDefault(str(), 'development'),
  }),

  /** The `client`-block variant of {@link presets.posthog} for Next.js bundles. */
  posthogClient: (): {
    NEXT_PUBLIC_POSTHOG_KEY: Validator<string | undefined>;
    NEXT_PUBLIC_POSTHOG_HOST: Validator<string | undefined>;
  } => ({
    NEXT_PUBLIC_POSTHOG_KEY: optional(str()),
    NEXT_PUBLIC_POSTHOG_HOST: optional(str()),
  }),

  /** The `client`-block variant of {@link presets.sentry} + `APP_ENV` for Next.js bundles. */
  sentryClient: (): {
    NEXT_PUBLIC_SENTRY_DSN: Validator<string | undefined>;
    NEXT_PUBLIC_APP_ENV: Validator<string>;
  } => ({
    NEXT_PUBLIC_SENTRY_DSN: optional(str()),
    NEXT_PUBLIC_APP_ENV: withDefault(str(), 'development'),
  }),
} as const;
