import { describe, expect, it } from 'vitest';
import {
  createSettings,
  DEFAULT_PROFILE,
  optional,
  PROFILE_VAR,
  requiredIn,
  secret,
  SettingsError,
  str,
  url,
  withDefault,
} from '../src/index';

/**
 * Mirrors `mod tests` in `rust/src/settings/tests.rs` (`required_in_*` and
 * `required_var_names_*`): the profile semantics are part of the shared
 * contract, so a change here needs the same change there.
 */
const schema = {
  SMTP_HOST: requiredIn(optional(str()), 'production'),
  PUBLIC_ORIGIN: requiredIn(withDefault(url(), 'http://localhost:3000'), 'production', 'staging'),
  POSTHOG_KEY: optional(str()),
} as const;

describe('requiredIn', () => {
  it('is inert outside the named profiles', () => {
    // APP_ENV unset ⇒ development
    const settings = createSettings({ server: schema, runtimeEnv: {} });
    expect(settings.SMTP_HOST).toBeUndefined();
    expect(settings.PUBLIC_ORIGIN).toBe('http://localhost:3000');

    const preview = createSettings({ server: schema, runtimeEnv: { [PROFILE_VAR]: 'preview' } });
    expect(preview.SMTP_HOST).toBeUndefined();
  });

  it('fails the load in a named profile, default included', () => {
    let error: unknown;
    try {
      createSettings({ server: schema, runtimeEnv: { [PROFILE_VAR]: 'production' } });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(SettingsError);
    const { issues, message } = error as SettingsError;
    expect(issues.map((issue) => issue.key)).toEqual(['SMTP_HOST', 'PUBLIC_ORIGIN']);
    expect(issues[0]).toEqual({ key: 'SMTP_HOST', kind: 'missing-in-profile', profile: 'production', profileFromVar: true });
    // Same wording as the Rust `Display` impl.
    expect(message).toContain('SMTP_HOST: missing (required when APP_ENV=production)');
  });

  it('does not blame APP_ENV when an explicit profile decided it', () => {
    let error: unknown;
    try {
      createSettings({ server: schema, runtimeEnv: {}, profile: 'production' });
    } catch (caught) {
      error = caught;
    }
    // Naming APP_ENV here would send whoever reads it to a variable that had no
    // say — the Next.js case, where the profile comes from NODE_ENV.
    expect((error as SettingsError).message).toContain('SMTP_HOST: missing (required when the active profile is production)');
    expect((error as SettingsError).message).not.toContain('APP_ENV');
  });

  it('honours every named profile independently', () => {
    const staging = createSettings({
      server: schema,
      runtimeEnv: { [PROFILE_VAR]: 'staging', PUBLIC_ORIGIN: 'https://staging.evinvest.ltd' },
    });
    expect(staging.SMTP_HOST).toBeUndefined(); // staging does not name SMTP_HOST
    expect(staging.PUBLIC_ORIGIN).toBe('https://staging.evinvest.ltd');
  });

  it('still parses a value that is present', () => {
    const settings = createSettings({
      server: schema,
      runtimeEnv: {
        [PROFILE_VAR]: 'production',
        SMTP_HOST: 'smtp.gmail.com',
        PUBLIC_ORIGIN: 'https://evinvest.ltd',
      },
    });
    expect(settings.SMTP_HOST).toBe('smtp.gmail.com');
    expect(settings.PUBLIC_ORIGIN).toBe('https://evinvest.ltd');
  });

  it('reports an invalid present value as invalid, not as missing', () => {
    let error: unknown;
    try {
      createSettings({
        server: schema,
        runtimeEnv: { [PROFILE_VAR]: 'production', SMTP_HOST: 'smtp.gmail.com', PUBLIC_ORIGIN: 'not a url' },
      });
    } catch (caught) {
      error = caught;
    }
    expect((error as SettingsError).issues[0]?.kind).toBe('invalid');
  });

  it('treats an empty string as unset, like every other variable', () => {
    expect(() => createSettings({ server: schema, runtimeEnv: { [PROFILE_VAR]: 'production', SMTP_HOST: '' } })).toThrowError(
      SettingsError,
    );
  });

  it('never leaks a secret value it did receive', () => {
    let error: unknown;
    try {
      createSettings({
        server: { SMTP_PASSWORD: requiredIn(optional(secret(url())), 'production') },
        runtimeEnv: { [PROFILE_VAR]: 'production', SMTP_PASSWORD: 'hunter2' },
      });
    } catch (caught) {
      error = caught;
    }
    expect((error as SettingsError).message).not.toContain('hunter2');
  });

  it('rejects requiredIn on a setting that is already required everywhere', () => {
    expect(() => createSettings({ server: { TOKEN: requiredIn(str(), 'production') }, runtimeEnv: {} })).toThrowError(
      /required everywhere/,
    );
  });

  it('takes an explicit profile over APP_ENV', () => {
    expect(() =>
      createSettings({ server: schema, runtimeEnv: { [PROFILE_VAR]: 'development' }, profile: 'production' }),
    ).toThrowError(SettingsError);
  });

  it('pins the canonical profile names', () => {
    expect(PROFILE_VAR).toBe('APP_ENV');
    expect(DEFAULT_PROFILE).toBe('development');
  });
});
