/**
 * A phone number as the funnel keeps it: E.164 when the typed value is one we
 * can read, otherwise exactly as typed. Soft by design — a number we cannot
 * parse is still a way to reach someone, and refusing it loses the customer.
 *
 * Only the French national plan is read (every brand of the vertical is in
 * France): `06 12 34 56 78`, `+33 (0)6 …`, `0033 6 …` and a mobile typed
 * without its trunk zero (`6 12 34 56 78`) all become `+33612345678`. Any
 * other international number is compacted (`+44 7911 123456` →
 * `+447911123456`); anything else is `null`.
 */
export function normalizePhone(raw: string): string | null {
  let s = raw.replace(/\(0\)/g, "").replace(/[\s.\-()/ ]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (s.startsWith("+33")) {
    const national = /^\+330?([1-9]\d{8})$/.exec(s);
    return national ? `+33${national[1]}` : null;
  }
  const trunk = /^0([1-9]\d{8})$/.exec(s);
  if (trunk) return `+33${trunk[1]}`;
  if (/^[1-9]\d{8}$/.test(s)) return `+33${s}`;
  if (/^\+[1-9]\d{7,14}$/.test(s)) return s;
  return null;
}

/** Whether a typed number reads as one — the form's soft check, never a block. */
export function isPlausiblePhone(raw: string): boolean {
  return normalizePhone(raw) !== null;
}

/**
 * A French mobile (`+33 6…`, `+33 7…`) — the one kind an SMS reaches. A
 * landline answers a text with silence, so the channel is not offered for it.
 */
export function isMobilePhone(raw: string): boolean {
  return /^\+33[67]\d{8}$/.test(normalizePhone(raw) ?? "");
}
