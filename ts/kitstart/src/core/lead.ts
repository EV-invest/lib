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

/** Why a submission was kept but not acted on. `null` is a clean lead. */
export type SpamVerdict = "honeypot" | "too-fast" | "rate-limited";

/**
 * One more field a brand's form asks for, capped at its own `max` characters —
 * not at `MAX_FIELD`, which caps the core fields: a free-text note may be longer.
 */
export interface LeadExtra {
  name: string;
  max: number;
}

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
   * The one rule worth enforcing, as a reason for the log (never rendered), or
   * `null` to accept. Absent → every candidate is a lead.
   */
  validate?: (lead: LeadCandidate) => string | null;
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
}

export type LeadCandidate = Omit<Lead, "spamVerdict">;

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
  insert(lead: Lead): Promise<number>;
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
 * 4 + the brand's extras. Append only.
 */
export const LEAD_SCHEMA_VERSION = 4;

/** A field is capped, not rejected: a long answer is still a customer. */
export const MAX_FIELD = 200;

function field(form: FormData, name: string, max: number): string | null {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : null;
}

/** The candidate a form posted, read through the schema's field names. */
export function readCandidate(
  schema: LeadSchema<string>,
  form: FormData,
  placeSlug: string | null,
): LeadCandidate {
  const extras: Record<string, string> = {};
  for (const extra of schema.extras ?? []) {
    const value = field(form, extra.name, extra.max);
    if (value) extras[extra.name] = value;
  }
  return {
    subject: field(form, schema.wire.subject, MAX_FIELD) ?? "",
    locality: field(form, schema.wire.locality, MAX_FIELD) ?? "",
    mobile: field(form, schema.wire.mobile, MAX_FIELD) ?? "",
    extras,
    placeSlug,
  };
}

export function validateCandidate(schema: LeadSchema<string>, lead: LeadCandidate): string | null {
  return schema.validate?.(lead) ?? null;
}
