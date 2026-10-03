import { readCandidate, validateCandidate, type LeadSchema } from "../core/lead";
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
  { mobile: "+12345678", valid: true },
  { mobile: "０６１２３４５６７８", valid: true },
  { mobile: "(415) 555-0123", valid: false },
  { mobile: "+3361234567", valid: false },
  { mobile: "0000000000", valid: false },
  { mobile: "06 66 66 66 66", valid: false },
  { mobile: "06 12 34 56 7", valid: false },
  { mobile: "12 34 56 7", valid: false },
  { mobile: "+1234567", valid: false },
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
