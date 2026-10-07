import { CHANNEL_FIELD, readCandidate, validateCandidate, type LeadSchema } from "../core/lead";
import { phoneProblem } from "../core/phone";

/**
 * Numbers people type, and whether each is a way to reach them — the
 * review's matrix (LEAD-FORMS-REVIEW-2026-10-03) and the spellings that must
 * keep working.
 */
export const PHONE_MATRIX: readonly { mobile: string; valid: boolean }[] = [
  { mobile: "06 12 34 56 78", valid: true },
  { mobile: "0612345678", valid: true },
  { mobile: "6 12 34 56 78", valid: true },
  { mobile: "+33 (0)6 12 34 56 78", valid: true },
  { mobile: "0033 6 12 34 56 78", valid: true },
  { mobile: "06.12.34.56.78", valid: true },
  { mobile: "06-12-34-56-78", valid: true },
  { mobile: "01 23 45 67 89", valid: true },
  { mobile: "+1 415 555 0123", valid: true },
  { mobile: "+44 7911 123456", valid: true },
  { mobile: "+32 470 12 34 56", valid: true },
  { mobile: "+41 44 668 18 00", valid: true },
  { mobile: "+49 30 1234567", valid: true },
  { mobile: "+34 612 345 678", valid: true },
  { mobile: "+39 06 1234 5678", valid: true },
  { mobile: "+44 20 7946 0958", valid: true },
  { mobile: "+352 621 123 456", valid: true },
  { mobile: "０６１２３４５６７８", valid: true },
  { mobile: "(415) 555-0123", valid: false },
  { mobile: "+3361234567", valid: false },
  { mobile: "0000000000", valid: false },
  { mobile: "06 66 66 66 66", valid: false },
  { mobile: "06 12 34 56 7", valid: false },
  { mobile: "12 34 56 7", valid: false },
  { mobile: "+1234567", valid: false },
  // A known plan's number short of its national length (LEAD-FORMS-RETEST-2026-10-03).
  { mobile: "+12345678", valid: false },
  { mobile: "+1 415 555 012", valid: false },
  { mobile: "+44 7911 1234", valid: false },
  { mobile: "+34 612 345 67", valid: false },
  { mobile: "+41 44 668 18 0", valid: false },
  { mobile: "+32 470 123", valid: false },
  { mobile: "+49 30 1234", valid: false },
  { mobile: "06 12", valid: false },
];

/**
 * Where a brand's form rule disagrees with the form's own phone check: a
 * number the form lets through that the server refuses (the visitor is sent
 * back for nothing they can see), or one the form blocks that the rule would
 * take. Every other field is filled as the form fills it — the first subject,
 * a postcode — so only the phone is judged. Empty is agreement.
 */
export function leadRuleDisagreements(schema: LeadSchema<string>): string[] {
  const out: string[] = [];
  for (const { mobile } of PHONE_MATRIX) {
    const form = new FormData();
    form.set(schema.wire.subject, schema.subjects[0] ?? "");
    form.set(schema.wire.locality, "75011");
    form.set(schema.wire.mobile, mobile);
    const blocked = phoneProblem(mobile) !== null;
    const refused = validateCandidate(schema, readCandidate(schema, form, null)) !== null;
    if (blocked !== refused) out.push(`${mobile}: the form ${blocked ? "blocks" : "takes"} it, the server ${refused ? "refuses" : "takes"} it`);
  }
  return out;
}

/**
 * Where a brand's form rule refuses a messenger lead it must take: one with
 * the subject chosen and nothing else — no postcode, no phone — since the
 * chat carries the rest and is how the business answers. And where it takes
 * a typed number the form would block: a phone given to a messenger lead is
 * still one the operator may call. Empty is agreement.
 */
export function messengerRuleDisagreements(schema: LeadSchema<string>): string[] {
  const out: string[] = [];
  for (const channel of ["whatsapp", "telegram"] as const) {
    const bare = new FormData();
    bare.set(schema.wire.subject, schema.subjects[0] ?? "");
    bare.set(CHANNEL_FIELD, channel);
    const refused = validateCandidate(schema, readCandidate(schema, bare, null));
    if (refused) out.push(`${channel}: a lead with no postcode and no phone is refused at ${refused.field} (${refused.why})`);
    for (const { mobile } of PHONE_MATRIX) {
      const form = new FormData();
      form.set(schema.wire.subject, schema.subjects[0] ?? "");
      form.set(CHANNEL_FIELD, channel);
      form.set(schema.wire.mobile, mobile);
      const blocked = phoneProblem(mobile) !== null;
      const refused = validateCandidate(schema, readCandidate(schema, form, null)) !== null;
      if (blocked !== refused) out.push(`${channel} ${mobile}: the form ${blocked ? "blocks" : "takes"} it, the server ${refused ? "refuses" : "takes"} it`);
    }
  }
  return out;
}
