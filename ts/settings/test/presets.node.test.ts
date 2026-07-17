import { describe, expect, it } from 'vitest';
import { createSettings, presets } from '../src/index';

// The canonical names are the contract — mirrored by `settings::presets` in
// the Rust feature (which has no client-side variants: `NEXT_PUBLIC_*` is a
// browser-bundler concern).
describe('presets', () => {
  it('fixes the canonical server-side names', () => {
    expect(Object.keys(presets.posthog())).toEqual(['POSTHOG_KEY', 'POSTHOG_HOST']);
    expect(Object.keys(presets.sentry())).toEqual(['SENTRY_DSN']);
    expect(Object.keys(presets.appEnv())).toEqual(['APP_ENV']);
  });

  it('fixes the canonical NEXT_PUBLIC_ client names', () => {
    expect(Object.keys(presets.posthogClient())).toEqual(['NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_HOST']);
    expect(Object.keys(presets.sentryClient())).toEqual(['NEXT_PUBLIC_SENTRY_DSN', 'NEXT_PUBLIC_APP_ENV']);
  });

  it('posthog/sentry are optional, APP_ENV defaults to development', () => {
    const settings = createSettings({
      server: { ...presets.posthog(), ...presets.sentry(), ...presets.appEnv() },
      runtimeEnv: { POSTHOG_KEY: 'phc_1' },
      isServer: true,
    });
    expect(settings.POSTHOG_KEY).toBe('phc_1');
    expect(settings.POSTHOG_HOST).toBeUndefined();
    expect(settings.SENTRY_DSN).toBeUndefined();
    expect(settings.APP_ENV).toBe('development');

    const production = createSettings({
      server: presets.appEnv(),
      runtimeEnv: { APP_ENV: 'production' },
      isServer: true,
    });
    expect(production.APP_ENV).toBe('production');
  });
});
