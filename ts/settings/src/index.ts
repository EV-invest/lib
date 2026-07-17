/**
 * @module @evinvest/settings
 *
 * Typed, validated env settings with aggregate error reporting and a
 * server/client split. Zero runtime dependencies, no DOM, no framework — one
 * server-safe, browser-safe entry.
 *
 * This is the TypeScript mirror of the `settings` Cargo feature of the
 * [`ev_lib`](https://github.com/EV-invest/lib) Rust crate; it preserves the
 * _semantics_ (var naming, required-by-default, empty-string-is-unset, the
 * bool/list parsing rules, aggregate errors, secret redaction) while reading
 * like idiomatic TS.
 *
 * The library reads **environment variables only** — no config files, no hot
 * reload (a process's environment is fixed at startup). Secrets management
 * stays at the shell/CI boundary (sops + age — see the GUIDE); this package
 * never decrypts anything, it only reads the already-injected environment.
 */

export { SettingsError, type SettingsIssue, type SettingsIssueKind } from './error';
export {
  bool,
  int,
  list,
  num,
  oneOf,
  optional,
  port,
  secret,
  str,
  url,
  withDefault,
  type Validator,
} from './validators';
export {
  createSettings,
  type CreateSettingsOptions,
  type InferSettings,
  type SettingsSchema,
} from './create-settings';
export { presets } from './presets';
