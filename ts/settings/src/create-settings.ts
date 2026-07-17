/**
 * {@link createSettings} — read a validated, typed settings object out of an
 * explicitly injected environment record, with a server/client split for
 * browser bundles.
 */

import { SettingsError, type SettingsIssue } from './error';
import type { Validator } from './validators';

/** A settings declaration: env var name → {@link Validator}. */
export type SettingsSchema = Record<string, Validator<unknown>>;

/** The typed settings object a schema produces. */
export type InferSettings<S extends SettingsSchema> = {
  readonly [K in keyof S]: S[K] extends Validator<infer T> ? T : never;
};

export interface CreateSettingsOptions<S extends SettingsSchema, C extends SettingsSchema> {
  /** Server-only settings. Accessing one from client code throws. */
  readonly server?: S;
  /**
   * Client-exposable settings. Every key must start with {@link clientPrefix}
   * so nothing leaks into a browser bundle by accident.
   */
  readonly client?: C;
  /** Required when `client` is non-empty — e.g. `NEXT_PUBLIC_`. */
  readonly clientPrefix?: string;
  /**
   * The environment record, destructured **explicitly** — bundlers inline
   * `process.env.NEXT_PUBLIC_*` / `import.meta.env.*` at build time only when
   * each variable is a static member expression, so a bare `process.env` pass
   * works on the server but leaves client values undefined in the browser:
   *
   * ```ts
   * runtimeEnv: {
   *   DATABASE_URL: process.env.DATABASE_URL,
   *   NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
   * }
   * ```
   */
  readonly runtimeEnv: Readonly<Record<string, string | undefined>>;
  /** Contract: `VAR=` (empty string) behaves like unset. Default `true`. */
  readonly emptyStringAsUnset?: boolean;
  /**
   * Where we are running. Default: `window` is absent from `globalThis`.
   * Override for workers or exotic runtimes.
   */
  readonly isServer?: boolean;
}

/**
 * Validate the injected environment against the schema and return the typed,
 * read-only settings object. Mirrors the Rust `settings!` macro's
 * `from_source`, plus the client/server split (a bundler concern with no Rust
 * equivalent).
 *
 * - Every missing/invalid variable is reported at once in one
 *   {@link SettingsError} — no fix-one-reboot-fix-next loops.
 * - Validation runs eagerly, at the `createSettings` call. Call it at module
 *   scope of a single `settings.ts` so a bad environment fails the boot (or,
 *   in Next.js, the build — import your settings module from `next.config`).
 * - On the client only the `client` schema is validated (server values never
 *   reach the bundle); accessing a server key there throws.
 *
 * @example
 * ```ts
 * export const settings = createSettings({
 *   server: {
 *     DATABASE_URL: url(),
 *     SIGNING_KEY: secret(str()),
 *     PORT: withDefault(port(), '8080'),
 *     ...presets.posthog(),
 *   },
 *   clientPrefix: 'NEXT_PUBLIC_',
 *   client: { ...presets.posthogClient() },
 *   runtimeEnv: {
 *     DATABASE_URL: process.env.DATABASE_URL,
 *     SIGNING_KEY: process.env.SIGNING_KEY,
 *     PORT: process.env.PORT,
 *     POSTHOG_KEY: process.env.POSTHOG_KEY,
 *     POSTHOG_HOST: process.env.POSTHOG_HOST,
 *     NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
 *     NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
 *   },
 * });
 * ```
 */
export function createSettings<
  S extends SettingsSchema = Record<never, never>,
  C extends SettingsSchema = Record<never, never>,
>(options: CreateSettingsOptions<S, C>): InferSettings<S> & InferSettings<C> {
  const server: SettingsSchema = options.server ?? {};
  const client: SettingsSchema = options.client ?? {};
  const { clientPrefix } = options;
  const emptyAsUnset = options.emptyStringAsUnset ?? true;
  const isServer = options.isServer ?? !('window' in globalThis);

  const serverKeys = Object.keys(server);
  const clientKeys = Object.keys(client);

  // Declaration bugs (not environment problems) fail fast as plain errors.
  if (clientKeys.length > 0 && clientPrefix === undefined) {
    throw new Error('@evinvest/settings: `clientPrefix` is required when `client` settings are declared');
  }
  for (const key of serverKeys) {
    // `in` would also match Object.prototype members ("toString", …).
    if (Object.hasOwn(client, key)) {
      throw new Error(`@evinvest/settings: setting "${key}" is declared in both server and client`);
    }
  }
  if (clientPrefix !== undefined) {
    for (const key of clientKeys) {
      if (!key.startsWith(clientPrefix)) {
        throw new Error(`@evinvest/settings: client setting "${key}" must start with clientPrefix "${clientPrefix}"`);
      }
    }
    for (const key of serverKeys) {
      if (key.startsWith(clientPrefix)) {
        throw new Error(
          `@evinvest/settings: server setting "${key}" starts with clientPrefix "${clientPrefix}" — declare it under \`client\``,
        );
      }
    }
  }
  for (const [key, validator] of [...Object.entries(server), ...Object.entries(client)]) {
    if (validator.optional && validator.defaultLiteral !== undefined) {
      throw new Error(
        `@evinvest/settings: setting "${key}" is both optional and defaulted — a defaulted setting is always present, drop one`,
      );
    }
  }

  // On the client, server values never reach the bundle: validate (and store)
  // the client schema only.
  const active = isServer ? { ...server, ...client } : client;
  const issues: SettingsIssue[] = [];
  const values: Record<string, unknown> = {};
  for (const [key, validator] of Object.entries(active)) {
    let raw = options.runtimeEnv[key];
    if (emptyAsUnset && raw === '') raw = undefined;
    // A default literal lives in source code, so it is never redacted.
    const fromDefault = raw === undefined && validator.defaultLiteral !== undefined;
    if (fromDefault) raw = validator.defaultLiteral;
    if (raw === undefined) {
      if (validator.optional) {
        values[key] = undefined;
        continue;
      }
      issues.push({ key, kind: 'missing' });
      continue;
    }
    try {
      values[key] = validator.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push({
        key,
        kind: 'invalid',
        detail: fromDefault ? `invalid default: ${message}` : message,
        ...(validator.secret && !fromDefault ? {} : { value: raw }),
      });
    }
  }
  if (issues.length > 0) throw new SettingsError(issues);

  Object.freeze(values); // the documented read-only contract, enforced (ESM is strict mode: writes throw)
  const serverOnly = new Set(serverKeys);
  return new Proxy(values, {
    get(target, prop, receiver) {
      if (typeof prop !== 'string') return Reflect.get(target, prop, receiver);
      if (!isServer && serverOnly.has(prop)) {
        throw new Error(`@evinvest/settings: attempted to access server-only setting "${prop}" on the client`);
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as InferSettings<S> & InferSettings<C>;
}
