/**
 * A phone number as the funnel reads it: E.164 when the typed value is a
 * number someone can be reached on, otherwise `null`.
 *
 * Only the French national plan is read closely (every brand of the vertical
 * is in France): ten digits from `0[1-9]` — `06 12 34 56 78`, `+33 (0)6 …`,
 * `0033 6 …`, a mobile typed without its trunk zero (`6 12 34 56 78`) — all
 * become `+33612345678`. Any other international number is a plausible E.164,
 * 8 to 15 digits after the `+`, compacted (`+44 7911 123456` →
 * `+447911123456`). Full-width digits read as digits; a run of one digit
 * (`00 00 00 00 00`, `06 66 66 66 66`) is a refusal to give a number, not one.
 */
export function normalizePhone(raw: string): string | null {
  // NFKC: a Japanese or Chinese keyboard types full-width digits and `＋`,
  // and a pasted number may carry no-break spaces. `\s` takes those too.
  let s = raw.normalize("NFKC").replace(/\(0\)/g, "").replace(/[\s.\-()/]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  let e164: string | null = null;
  if (s.startsWith("+33")) {
    const national = /^\+330?([1-9]\d{8})$/.exec(s);
    e164 = national ? `+33${national[1]}` : null;
  } else {
    const trunk = /^0([1-9]\d{8})$/.exec(s);
    if (trunk) e164 = `+33${trunk[1]}`;
    else if (/^[1-9]\d{8}$/.test(s)) e164 = `+33${s}`;
    else if (/^\+[1-9]\d{7,14}$/.test(s)) e164 = s;
  }
  if (e164 === null) return null;
  // The subscriber's digits: past `+33` for a French number, past `+` otherwise.
  const subscriber = e164.startsWith("+33") ? e164.slice(3) : e164.slice(1);
  return /^(\d)\1+$/.test(subscriber) ? null : e164;
}

/**
 * Whether a typed number is one we can call back — the one rule the form,
 * the callback and the server share (`phoneProblem`, `validateLead`).
 */
export function isPlausiblePhone(raw: string): boolean {
  return normalizePhone(raw) !== null;
}

/**
 * What is wrong with a typed number, or `null`: `required` when nothing was
 * typed, `invalid` when it is not a number we can call. The form blocks on it
 * in the page's words and the server refuses on it — one rule, so a number
 * the form lets through is never refused behind the visitor's back.
 */
export function phoneProblem(raw: string): "required" | "invalid" | null {
  if (raw.trim() === "") return "required";
  return isPlausiblePhone(raw) ? null : "invalid";
}

/**
 * A French mobile (`+33 6…`, `+33 7…`) — the one kind an SMS reaches. A
 * landline answers a text with silence, so the channel is not offered for it.
 */
export function isMobilePhone(raw: string): boolean {
  return /^\+33[67]\d{8}$/.test(normalizePhone(raw) ?? "");
}
