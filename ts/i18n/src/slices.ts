/**
 * Sending a page only the keys it renders. Zero-dep and DOM-free, like the rest
 * of the core: the server picks, the client never sees what was left out.
 */
import type { Messages } from "./registry";

/**
 * Which keys each part of an app renders on the client — what
 * `evinvest-i18n-slices` writes. Keys are sorted; a route's list leaves out
 * what `shell` already carries.
 */
export interface MessageSlices {
  /** Rendered by layouts and boundary files (error, not-found, …): the provider's catalogue. */
  shell: string[];
  /** Per page entry (`app/…/page.tsx`): what its `I18nScope` adds to the shell. */
  routes: Record<string, string[]>;
  /** In the code, but no client slice carries them — rendered on the server, if at all. */
  serverOnly: string[];
}

/**
 * The part of `messages` under `keys`, for an `I18nProvider` or `I18nScope`.
 * A key the catalogue lacks is left out rather than invented — the call site's
 * English renders for it, exactly as with the whole catalogue.
 *
 * @example
 * ```ts
 * pickMessages(messagesFor(locale), slices.shell);
 * ```
 */
export function pickMessages(messages: Messages, keys: Iterable<string>): Messages {
  const picked: [string, string][] = [];
  for (const key of keys) {
    // Own keys only, so `toString` or `__proto__` never come off the prototype.
    const pattern = Object.hasOwn(messages, key) ? messages[key] : undefined;
    if (pattern !== undefined) picked.push([key, pattern]);
  }
  // `fromEntries` defines plain own properties: a `__proto__` key stays data,
  // and the result keeps `Object.prototype`, which RSC needs to serialise it.
  return Object.fromEntries(picked);
}
