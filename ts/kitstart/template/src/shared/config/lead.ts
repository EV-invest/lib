import { validateLead, type LeadSchema } from "@evinvest/kitstart";

export const SUBJECTS = ["standard", "deep", "other"] as const;
export type Subject = (typeof SUBJECTS)[number];

/**
 * What the quote form asks, and the one rule worth enforcing: a lead with no
 * way to reach the customer is not a lead. `validateLead` is the number rule
 * the form itself blocks on; a brand rule of its own composes with it —
 * `lead => validateLead(lead) ?? mine(lead)` — and names the field it refuses,
 * which the form shows the error at.
 */
export const LEAD: LeadSchema<Subject> = {
  subjects: SUBJECTS,
  wire: { subject: "subject", locality: "locality", mobile: "mobile" },
  extras: [{ name: "surface_m2", max: 6 }],
  // One shape for the mail, the webhook and a dialler: `+33612345678`.
  mobileFormat: "e164",
  validate: validateLead,
};
