/**
 * The QA switcher's one decision a visitor pays for, apart from the rest
 * (`ab-switcher.ts`) so the gate's bundle carries this function and nothing
 * else: the panel's helpers arrive with the panel.
 */

/**
 * Whether the switcher shows: always outside production, and in production
 * only to a visit carrying the QA cookie with a value — the cookie the brand's
 * force parameter sets, so nobody else ever downloads the panel.
 */
export function abSwitcherVisible(cookies: string, qaCookie: string, nodeEnv: string | undefined): boolean {
  if (nodeEnv !== "production") return true;
  // Presence and non-empty only, no decoding: every visitor runs this. The
  // rule is `qaVisit`'s (analytics.ts), copied so the switcher and the
  // analytics island share no module; `forced.node.test.ts` holds them equal.
  return cookies.split(";").some(pair => {
    const eq = pair.indexOf("=");
    return eq > 0 && pair.slice(0, eq).trim() === qaCookie && pair.slice(eq + 1).trim() !== "";
  });
}
