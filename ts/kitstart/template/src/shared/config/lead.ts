import type { LeadSchema } from "@evinvest/kitstart";

export const SUBJECTS = ["standard", "deep", "other"] as const;
export type Subject = (typeof SUBJECTS)[number];

/**
 * What the quote form asks, and the one rule worth enforcing: a lead with no
 * way to reach the customer is not a lead. The reason is for the log only.
 */
export const LEAD: LeadSchema<Subject> = {
  subjects: SUBJECTS,
  wire: { subject: "subject", locality: "locality", mobile: "mobile" },
  extras: [{ name: "surface_m2", max: 6 }],
  validate: lead => (lead.mobile.replace(/\D/g, "").length < 10 ? "a mobile number" : null),
};
