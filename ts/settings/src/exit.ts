/**
 * Failing a boot on bad configuration, with an exit code that says so —
 * the mirror of `ev_lib::settings::or_exit`.
 */

import { SettingsError } from './error';

/**
 * `EX_CONFIG` from `sysexits.h`: the process died because its configuration is
 * wrong, not because a dependency blipped. Restarting it unchanged cannot help
 * — which is exactly what an operator (and a CrashLoopBackOff triage) needs to
 * know.
 */
export const EX_CONFIG = 78;

/**
 * Run a settings load; on {@link SettingsError} print every problem and exit
 * {@link EX_CONFIG}. Any other error propagates untouched — a broken database
 * is not a broken config.
 *
 * Node only, by construction: in a browser there is no exit code to set, so the
 * error is rethrown and the caller decides.
 *
 * ```ts
 * // instrumentation.ts — before the server accepts traffic
 * export function register() {
 *   orExit(() => assertConfig());
 * }
 * ```
 */
export function orExit<T>(load: () => T): T {
  try {
    return load();
  } catch (error) {
    if (!(error instanceof SettingsError)) throw error;
    const exit = (globalThis as { process?: { exit?: (code: number) => never } }).process?.exit;
    if (typeof exit !== 'function') throw error;
    console.error(error.message);
    return exit(EX_CONFIG); // `never`, so it satisfies T without pretending to produce one
  }
}
