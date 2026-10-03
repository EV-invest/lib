/**
 * The lead as data. Every landing asks for a subject (what the job is), a
 * locality (where to go) and a mobile (how to answer); what else it asks for
 * is the brand's `extras`, and what it refuses is the brand's `validate`. The
 * funnel's order — validate → screen → insert → deferred notify — is the
 * machinery's, not the schema's.
 *
 * `Lead.subject` is a plain `string` (a stale form's value is still a job) and
 * `LeadSchema.wire` names the posted fields (a page cached before a rename
 * still delivers) — both deliberate departures from the first design.
 */

import { normalizePhone, phoneProblem } from "./phone";
import type { LeadFlow, LeadFlows } from "./pricing/flow";
import type { PricingInputs } from "./pricing/model";

/** Why a submission was kept but not acted on. `null` is a clean lead. */
export type SpamVerdict = "honeypot" | "too-fast" | "rate-limited";

/**
 * One more field a brand's form asks for, capped at its own `max` characters —
 * not at `MAX_FIELD`, which caps the core fields: a free-text note may be longer.
 */
export interface LeadExtra {
  name: string;
  max: number;
  /**
   * A free-text note keeps its line breaks. Off by default: every other field
   * is one line, and a line break posted into one forges a line of the mail.
   */
  multiline?: boolean;
}

/**
 * Why a candidate is refused, and the field it is about — `phone`, `locality`,
 * `need`, `name`, `consent`, an extra's name, or `form` when the rule cannot
 * say. The field goes back to the form, which shows the error there; `why` is
 * for the log only, never rendered.
 */
export interface LeadRejection {
  field: string;
  why: string;
}

/** What a rule may answer: a rejection, a bare reason (read as `form`), or `null` to accept. */
export type LeadVerdict = LeadRejection | string | null;

/**
 * The form field each core value is posted under. Brand config, not a
 * constant: a page cached before a rename still posts the old names, and a
 * lead from it is still a customer.
 */
export interface LeadWire {
  subject: string;
  locality: string;
  mobile: string;
}

export interface LeadSchema<S extends string> {
  /** What the form's subject control offers, in order. */
  subjects: readonly S[];
  wire: LeadWire;
  extras?: readonly LeadExtra[];
  /**
   * The rule a form lead must pass, or `null` to accept. Absent →
   * `validateLead`: the number the form itself blocks on. A brand adding its
   * own rule composes it — `lead => validateLead(lead) ?? mine(lead)` — and
   * the landing contract holds it to the form's phone rule, so the server
   * never refuses a number the form let through. A bare string is a reason
   * about the whole form (`field: "form"`).
   */
  validate?: (lead: LeadCandidate) => LeadVerdict;
  /**
   * The rule for a callback request, which carries a phone and little else —
   * a form's rule would refuse it for the locality it never asked. Absent →
   * `validateCallbackLead`: a number we can call.
   */
  validateCallback?: (lead: LeadCandidate) => LeadVerdict;
  /**
   * How the mobile is kept: `typed` (default), exactly as posted, or `e164`,
   * `+33612345678` when it reads as a number and as typed when it does not.
   * Opt-in, because a brand's own tooling and tests look rows up by the
   * number as typed.
   */
  mobileFormat?: "typed" | "e164";
  /**
   * How each need is sold (`quote` | `estimate` | `fixed`); a need left out
   * is a `quote`. The form and the server read the same map, and a need runs
   * its flow only when the price list prices it that way (`flowOf`) — so a
   * flow the brand has not switched on is never run by a posted field.
   */
  flows?: LeadFlows;
}

/**
 * How the lead was asked for: the quote form, or "call me back" — the form cut
 * to a phone number. Posted as `CHANNEL_FIELD`; anything else, or nothing (a
 * page cached before the field existed), is `form`.
 */
export type LeadChannel = "form" | "callback";
export const LEAD_CHANNELS: readonly LeadChannel[] = ["form", "callback"];
export const CHANNEL_FIELD = "channel";

/**
 * The callback's consent: a checkbox whose value is the sentence it shows, in
 * the language it shows it, so the row keeps what was agreed to. Absent → the
 * callback is refused, as any invalid lead is.
 */
export const CONSENT_FIELD = "consent";
/** Longer than any consent sentence; past it, the text is cut, not refused. */
export const MAX_CONSENT = 500;

/** What a callback lead was agreed to, and when the server accepted it (ISO 8601). */
export interface LeadConsent {
  text: string;
  at: string;
}

/** The script's id for one submission, minted once and kept across its resends. */
export const SUBMISSION_FIELD = "submission_id";
export const SUBMISSION_ID = /^[A-Za-z0-9-]{16,64}$/;

/** The query a refused submission is sent back to the form with: `?lead_error=<field>`. */
export const LEAD_ERROR_PARAM = "lead_error";

/**
 * The card's id, posted so a refusal lands back on it (`#devis`, not a
 * hard-coded `#quote`). Only a slug is ever echoed into the redirect.
 */
export const CARD_FIELD = "card";
export const CARD_ID = /^[a-z0-9-]{1,64}$/;

/** A field as a refusal names it: a short slug, or the whole `form`. */
const FIELD_SLUG = /^[a-z][a-z0-9_]{0,31}$/;

/** A rule's answer as a rejection: a bare reason, or a field that is not a slug, is about the `form`. */
export function rejectionOf(verdict: LeadVerdict): LeadRejection | null {
  if (verdict === null) return null;
  if (typeof verdict === "string") return { field: "form", why: verdict };
  return FIELD_SLUG.test(verdict.field) ? verdict : { field: "form", why: verdict.why };
}

/** The default form rule: a number we can call — the one the form blocks on (`phoneProblem`). */
export function validateLead(lead: Pick<LeadCandidate, "mobile">): LeadRejection | null {
  const problem = phoneProblem(lead.mobile);
  return problem === null ? null : { field: "phone", why: problem === "required" ? "a phone number" : "a phone number we can call" };
}

/** The default callback rule: the same number rule, worded for the log. */
export function validateCallbackLead(lead: Pick<LeadCandidate, "mobile">): LeadRejection | null {
  return phoneProblem(lead.mobile) === null ? null : { field: "phone", why: "a phone number to call back" };
}

/**
 * A submitted lead. Values are trimmed and capped but not otherwise parsed: a
 * lead that cannot be fully validated is still a lead, and rejecting it loses
 * a customer to protect a column type. `subject` is kept as posted even when
 * it is not one of `subjects` — a stale form's value is still a job.
 */
export interface Lead {
  subject: string;
  locality: string;
  mobile: string;
  extras: Readonly<Record<string, string>>;
  /** The place it was submitted from — its slug — or `null` when unknown. */
  placeSlug: string | null;
  spamVerdict: SpamVerdict | null;
  /**
   * Absent on a lead built before the field existed — read it as `form`
   * (`channelOf`). Every lead the funnel reads has it.
   */
  channel?: LeadChannel;
  /** Only on a callback lead: the consent it was posted with. */
  consent?: LeadConsent;
  /**
   * The script's id for this submission (`SUBMISSION_FIELD`): a resend after
   * a lost answer carries the same one, and the store keeps one row per id.
   * Absent on a plain post, which has no script to mint one.
   */
  submissionId?: string;
  /**
   * How the need was sold, when the brand sells by flow (`LeadSchema.flows`)
   * and the lead came through the form; absent otherwise — a callback, or a
   * lead from before the field existed.
   */
  flow?: LeadFlow;
  /** Only on an `estimate` or `fixed` lead: the price the server computed. */
  price?: LeadPrice;
}

/**
 * The price a lead was taken at — the server's own number, from the posted
 * answers, never a posted amount — and the model it came from.
 */
export interface LeadPrice {
  cents: number;
  /** The model's `validFrom`, `YYYY-MM-DD`. */
  validFrom: string;
  /** An estimate's answers, input id → option id; absent for a fixed price. */
  inputs?: PricingInputs;
}

/** What the panel may be told of a suspected lead. */
export type LeadSuspect = "rate_limited" | "too_fast";

/**
 * Why a lead the panel receives is suspect, for its `suspect` property, or
 * nothing for a clean one. Never `honeypot`: a lead that filled the trap is a
 * bot's, kept in the table and sent nowhere.
 */
export function suspectOf(lead: Pick<Lead, "spamVerdict">): LeadSuspect | undefined {
  if (lead.spamVerdict === "rate-limited") return "rate_limited";
  if (lead.spamVerdict === "too-fast") return "too_fast";
  return undefined;
}

/** The lead's channel, `form` for one that predates the field. */
export function channelOf(lead: Pick<Lead, "channel">): LeadChannel {
  return lead.channel ?? "form";
}

/**
 * What the form posted, before the funnel judges it: the consent is the
 * posted sentence, and the funnel stamps when it accepted it.
 */
export type LeadCandidate = Omit<Lead, "spamVerdict" | "consent" | "flow" | "price"> & { consentText?: string };

/**
 * The port the funnel writes through — the commit point. `insert` resolves
 * with the row's id only once the lead is durable; a rejection is a lead the
 * visitor must not be thanked for. Async because not every adapter is
 * in-process: SQLite answers synchronously, a network database does not.
 *
 * An adapter migrates its storage forward on open, versioned by
 * `LEAD_SCHEMA_VERSION`, and must pass the shared contract suite
 * (`@evinvest/kitstart/testing`) before `LEADS_DB_URL` may select it.
 */
export interface LeadStore {
  /** Rejects a second lead with a `submissionId` the store already holds (a unique index). */
  insert(lead: Lead): Promise<number>;
  /**
   * The row a submission id was stored under, read back as a lead, or `null`.
   * Absent on an adapter that does not dedupe: every post is then a lead.
   */
  findSubmission?(submissionId: string): Promise<{ id: number; lead: Lead } | null>;
  count(): Promise<number>;
  /** The schema version the storage stands at after opening. */
  schemaVersion(): Promise<number>;
  /** Resolves while the store can take a lead; rejects with why it cannot. */
  health(): Promise<void>;
  close(): Promise<void>;
}

/**
 * The lead schema's version, shared by every adapter: 1 the Rust server's
 * table (`job`, `zip`, `mobile`, `at`), 2 + the place, 3 + the spam verdict,
 * 4 + the brand's extras, 5 + the channel and the callback's consent, 6 + the
 * script's submission id, unique, 7 + the flow and the price it was taken at.
 * Append only.
 */
export const LEAD_SCHEMA_VERSION = 7;

/** A field is capped, not rejected: a long answer is still a customer. */
export const MAX_FIELD = 200;

// C0 and C1 controls, DEL, and the Unicode line and paragraph separators.
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g;
// The same less the line feed: what a multi-line note keeps.
const CONTROL_BUT_NEWLINE = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]+/g;

/**
 * A posted value, trimmed and capped. One line unless `multiline`: a line
 * break or a control character posted into a one-line field (`63130\nMobile
 * : 07…`) would forge a line of the mail, so each run becomes one space.
 */
function field(form: FormData, name: string, max: number, multiline = false): string | null {
  const value = form.get(name);
  if (typeof value !== "string") return null;
  const clean = multiline ? value.replace(/\r\n?/g, "\n").replace(CONTROL_BUT_NEWLINE, "") : value.replace(CONTROL, " ").replace(/ {2,}/g, " ");
  return clean.trim().slice(0, max);
}

/**
 * The candidate a form posted, read through the schema's field names. Under
 * `mobileFormat: "e164"` the mobile is normalised before the brand's rule
 * sees it.
 */
export function readCandidate(
  schema: LeadSchema<string>,
  form: FormData,
  placeSlug: string | null,
): LeadCandidate {
  const extras: Record<string, string> = {};
  for (const extra of schema.extras ?? []) {
    const value = field(form, extra.name, extra.max, extra.multiline);
    if (value) extras[extra.name] = value;
  }
  const mobile = field(form, schema.wire.mobile, MAX_FIELD) ?? "";
  const callback = form.get(CHANNEL_FIELD) === "callback";
  const consent = callback ? field(form, CONSENT_FIELD, MAX_CONSENT) : null;
  const submission = field(form, SUBMISSION_FIELD, 64);
  return {
    subject: field(form, schema.wire.subject, MAX_FIELD) ?? "",
    locality: field(form, schema.wire.locality, MAX_FIELD) ?? "",
    mobile: schema.mobileFormat === "e164" ? (normalizePhone(mobile) ?? mobile) : mobile,
    extras,
    placeSlug,
    channel: callback ? "callback" : "form",
    ...(consent ? { consentText: consent } : {}),
    ...(submission && SUBMISSION_ID.test(submission) ? { submissionId: submission } : {}),
  };
}

/** The rule the candidate's channel answers to: the field a refusal is about, or `null`. */
export function validateCandidate(schema: LeadSchema<string>, lead: LeadCandidate): LeadRejection | null {
  if (channelOf(lead) === "callback") {
    // Not the brand's to waive: calling someone back needs their word for it.
    if (!lead.consentText) return { field: "consent", why: "consent to be called back" };
    return rejectionOf((schema.validateCallback ?? validateCallbackLead)(lead));
  }
  return rejectionOf((schema.validate ?? validateLead)(lead));
}
