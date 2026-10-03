/**
 * A phone number as the funnel reads it: E.164 when the typed value is a
 * number someone can be reached on, otherwise `null`.
 *
 * Only the French national plan is read closely (every brand of the vertical
 * is in France): ten digits from `0[1-9]` — `06 12 34 56 78`, `+33 (0)6 …`,
 * `0033 6 …`, a mobile typed without its trunk zero (`6 12 34 56 78`) — all
 * become `+33612345678`. Any other international number is a plausible E.164,
 * 8 to 15 digits after the `+`, compacted (`+44 7911 123456` →
 * `+447911123456`) — and, for the plans a visitor here most often dials
 * from (`NATIONAL_LENGTH`), as long as that plan's numbers are, so `+12345678`
 * is not a number. Full-width digits read as digits; a run of one digit
 * (`00 00 00 00 00`, `06 66 66 66 66`) is a refusal to give a number, not one.
 */
/**
 * The national number's length, after the country code, for the plans the
 * vertical's visitors most often come from — bounds wide enough for every
 * real number (Germany and Italy vary by area), short of a library. A plan
 * not listed keeps E.164's 8 to 15 digits in all.
 */
const NATIONAL_LENGTH: Readonly<Record<string, readonly [min: number, max: number]>> = {
  "1": [10, 10],
  "32": [8, 9],
  "34": [9, 9],
  "39": [6, 11],
  "41": [9, 9],
  "44": [9, 10],
  "49": [7, 13],
};

function fitsPlan(e164: string): boolean {
  const digits = e164.slice(1);
  for (const code of [digits.slice(0, 1), digits.slice(0, 2)]) {
    const bounds = NATIONAL_LENGTH[code];
    if (bounds) return digits.length - code.length >= bounds[0] && digits.length - code.length <= bounds[1];
  }
  return true;
}

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
    else if (/^\+[1-9]\d{7,14}$/.test(s) && fitsPlan(s)) e164 = s;
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
