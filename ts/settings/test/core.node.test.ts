import { describe, expect, it } from 'vitest';
import {
  bool,
  createSettings,
  int,
  list,
  num,
  oneOf,
  optional,
  port,
  secret,
  SettingsError,
  str,
  url,
  withDefault,
} from '../src/index';

describe('createSettings', () => {
  it('reads every field shape (required, defaulted, optional, secret, list)', () => {
    const settings = createSettings({
      server: {
        DATABASE_URL: str(),
        PORT: withDefault(port(), '8080'),
        DEBUG: withDefault(bool(), 'false'),
        ADMIN_SUBJECTS: withDefault(list(), ''),
        POSTHOG_KEY: optional(str()),
        SIGNING_KEY: secret(str()),
      },
      runtimeEnv: {
        DATABASE_URL: 'postgres://localhost/app',
        DEBUG: '1',
        ADMIN_SUBJECTS: 'alice, bob ,,carol',
        SIGNING_KEY: 'hunter2',
      },
      isServer: true,
    });

    expect(settings.DATABASE_URL).toBe('postgres://localhost/app');
    expect(settings.PORT).toBe(8080); // default applied
    expect(settings.DEBUG).toBe(true);
    expect(settings.ADMIN_SUBJECTS).toEqual(['alice', 'bob', 'carol']);
    expect(settings.POSTHOG_KEY).toBeUndefined();
    expect(settings.SIGNING_KEY).toBe('hunter2');
  });

  it('aggregates every missing/invalid variable into one SettingsError', () => {
    let thrown: SettingsError | undefined;
    try {
      createSettings({
        server: { DATABASE_URL: str(), PORT: port(), SIGNING_KEY: secret(str()) },
        runtimeEnv: { PORT: 'not-a-port', SIGNING_KEY: 'k' },
        isServer: true,
      });
    } catch (error) {
      thrown = error as SettingsError;
    }

    expect(thrown).toBeInstanceOf(SettingsError);
    expect(thrown!.issues.map((issue) => issue.key)).toEqual(['DATABASE_URL', 'PORT']);
    expect(thrown!.issues[0]).toEqual({ key: 'DATABASE_URL', kind: 'missing' });
    expect(thrown!.issues[1]!.value).toBe('not-a-port');
    // Message format is kept in step with the Rust `Display` impl.
    expect(thrown!.message).toMatch(/^invalid settings \(2 problems\)\n/);
    expect(thrown!.message).toContain('\n  - DATABASE_URL: missing');
    expect(thrown!.message).toContain('\n  - PORT: invalid value "not-a-port": ');
  });

  it('uses the singular for one problem', () => {
    expect(() => createSettings({ server: { ONLY: str() }, runtimeEnv: {}, isServer: true })).toThrowError(
      /^invalid settings \(1 problem\)\n/,
    );
  });

  it('treats the empty string as unset for every field kind', () => {
    // Required -> missing.
    expect(() => createSettings({ server: { NEEDED: str() }, runtimeEnv: { NEEDED: '' }, isServer: true })).toThrowError(
      SettingsError,
    );
    // Defaulted -> default; optional -> undefined.
    const settings = createSettings({
      server: { PORT: withDefault(port(), '8080'), MAYBE: optional(str()) },
      runtimeEnv: { PORT: '', MAYBE: '' },
      isServer: true,
    });
    expect(settings.PORT).toBe(8080);
    expect(settings.MAYBE).toBeUndefined();

    // Opting out keeps the empty string as a value.
    const kept = createSettings({
      server: { RAW: str() },
      runtimeEnv: { RAW: '' },
      emptyStringAsUnset: false,
      isServer: true,
    });
    expect(kept.RAW).toBe('');
  });

  it('redacts secret values in issues and in the message', () => {
    let thrown: SettingsError | undefined;
    try {
      createSettings({
        server: { ATTEMPTS: secret(int()) },
        runtimeEnv: { ATTEMPTS: 's3cr3t' },
        isServer: true,
      });
    } catch (error) {
      thrown = error as SettingsError;
    }
    expect(thrown!.issues[0]!.value).toBeUndefined();
    expect(thrown!.message).not.toContain('s3cr3t');
    expect(thrown!.message).toContain('ATTEMPTS: invalid value: ');
  });

  it('reports an unparsable default as `invalid default: …` only when used', () => {
    const fine = createSettings({
      server: { PORT: withDefault(port(), 'not-a-port') },
      runtimeEnv: { PORT: '80' },
      isServer: true,
    });
    expect(fine.PORT).toBe(80);

    let thrown: SettingsError | undefined;
    try {
      createSettings({ server: { PORT: withDefault(port(), 'not-a-port') }, runtimeEnv: {}, isServer: true });
    } catch (error) {
      thrown = error as SettingsError;
    }
    expect(thrown!.issues[0]!.detail).toMatch(/^invalid default: /);
    // The default literal lives in source code, so it is shown even for secrets.
    expect(thrown!.issues[0]!.value).toBe('not-a-port');
  });

  it('splits server and client: client validated everywhere, server only on the server', () => {
    const make = (isServer: boolean) =>
      createSettings({
        server: { DATABASE_URL: str() },
        clientPrefix: 'NEXT_PUBLIC_',
        client: { NEXT_PUBLIC_API_HOST: str() },
        runtimeEnv: { DATABASE_URL: 'db', NEXT_PUBLIC_API_HOST: 'api.example.com' },
        isServer,
      });

    const onServer = make(true);
    expect(onServer.DATABASE_URL).toBe('db');
    expect(onServer.NEXT_PUBLIC_API_HOST).toBe('api.example.com');

    const onClient = make(false);
    expect(onClient.NEXT_PUBLIC_API_HOST).toBe('api.example.com');
    expect(() => onClient.DATABASE_URL).toThrowError(/server-only setting "DATABASE_URL" on the client/);
    // Server values never even land in the client object.
    expect(Object.keys(onClient)).toEqual(['NEXT_PUBLIC_API_HOST']);
  });

  it('is read-only at runtime and tolerates prototype-named keys', () => {
    const settings = createSettings({
      server: { toString: str() }, // Object.prototype name must not confuse the checks
      runtimeEnv: { toString: 'x' },
      isServer: true,
    });
    expect(settings.toString).toBe('x');
    expect(() => {
      (settings as Record<string, unknown>)['toString'] = 'mutated';
    }).toThrowError(TypeError);
  });

  it('skips server validation on the client (missing server vars are fine there)', () => {
    const settings = createSettings({
      server: { DATABASE_URL: str() },
      clientPrefix: 'NEXT_PUBLIC_',
      client: { NEXT_PUBLIC_API_HOST: str() },
      runtimeEnv: { NEXT_PUBLIC_API_HOST: 'api.example.com' },
      isServer: false,
    });
    expect(settings.NEXT_PUBLIC_API_HOST).toBe('api.example.com');
  });

  it('rejects declaration bugs as plain errors, not SettingsError', () => {
    expect(() =>
      createSettings({ client: { NEXT_PUBLIC_X: str() }, runtimeEnv: { NEXT_PUBLIC_X: 'x' }, isServer: true }),
    ).toThrowError(/`clientPrefix` is required/);
    expect(() =>
      createSettings({
        clientPrefix: 'NEXT_PUBLIC_',
        client: { API_HOST: str() },
        runtimeEnv: { API_HOST: 'x' },
        isServer: true,
      }),
    ).toThrowError(/must start with clientPrefix/);
    expect(() =>
      createSettings({
        server: { NEXT_PUBLIC_LEAK: str() },
        clientPrefix: 'NEXT_PUBLIC_',
        client: { NEXT_PUBLIC_OK: str() },
        runtimeEnv: { NEXT_PUBLIC_LEAK: 'x', NEXT_PUBLIC_OK: 'x' },
        isServer: true,
      }),
    ).toThrowError(/starts with clientPrefix/);
    expect(() =>
      createSettings({
        server: { NEXT_PUBLIC_BOTH: str() },
        clientPrefix: 'NEXT_PUBLIC_',
        client: { NEXT_PUBLIC_BOTH: str() },
        runtimeEnv: { NEXT_PUBLIC_BOTH: 'x' },
        isServer: true,
      }),
    ).toThrowError(/declared in both server and client/);
    expect(() =>
      createSettings({
        server: { X: withDefault(optional(str()), 'x') },
        runtimeEnv: {},
        isServer: true,
      }),
    ).toThrowError(/both optional and defaulted/);
  });
});

describe('validators', () => {
  it('num/int/port draw their lines', () => {
    expect(num().parse('3.5')).toBe(3.5);
    expect(() => int().parse('3.5')).toThrowError(/integer/);
    expect(int().parse('-3')).toBe(-3);
    expect(port().parse('65535')).toBe(65535);
    expect(() => port().parse('0')).toThrowError(/port/);
    expect(() => port().parse('65536')).toThrowError(/port/);
    expect(() => num().parse('Infinity')).toThrowError(/finite/);
  });

  it('url validates but returns the original string', () => {
    expect(url().parse('https://eu.i.posthog.com')).toBe('https://eu.i.posthog.com');
    expect(() => url().parse('not a url')).toThrowError(/URL/);
    // `new URL` would strip padding/embedded whitespace and "validate" it.
    expect(() => url().parse(' https://a.example ')).toThrowError(/URL/);
    expect(() => url().parse('https://a.exa\nmple')).toThrowError(/URL/);
  });

  it('oneOf narrows to the declared values', () => {
    const env = oneOf(['development', 'production']);
    expect(env.parse('production')).toBe('production');
    expect(() => env.parse('staging')).toThrowError(/expected one of `development`, `production`/);
  });

  it('list parses items with the given validator', () => {
    expect(list(num()).parse('1, 2,3')).toEqual([1, 2, 3]);
    expect(() => list(num()).parse('1,x')).toThrowError(/^item 2: /);
  });
});
