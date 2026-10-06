import "server-only";
import { randomBytes } from "node:crypto";
import { EXPERIMENT_SLUG } from "../core/analytics";
import type { LeadWebhook } from "./lead-webhook";

/**
 * One experiment as the code declares it — the shape of an
 * `@evinvest/experiments` spec, so the brand's `as const` config is passed
 * as is. `variants[0]` is the control. No weights: the code splits equally,
 * and re-weighting is the panel's override.
 */
export interface DeclaredExperiment {
  readonly variants: readonly string[];
  readonly enabled?: boolean;
  readonly holdout?: number;
}

export type ExperimentsDeclaration = Readonly<Record<string, DeclaredExperiment>>;

/**
 * `ExperimentDeclaration` of the panel's `experiments.declared@1`. `weights`
 * stays in the contract; the code always sends one each (the equal split it
 * runs without an override).
 */
export interface ExperimentDeclarationV1 {
  key: string;
  variants: string[];
  weights: number[];
  enabled: boolean;
  holdout?: number;
  summary?: string;
}

/** `experiments.declared@1` as protojson: `sa.v1.Event` with `ExperimentsDeclaredV1` for properties. */
export interface ExperimentsDeclaredEvent {
  id: string;
  schema: "sa.funnel.v1";
  type: "experiments.declared";
  typeVersion: 1;
  occurredAt: string;
  source: { kind: "site"; id: string };
  subject: { brandId: string };
  properties: { experiments: ExperimentDeclarationV1[] };
}

const KEY = /^[a-z0-9_]{1,64}$/;
const MAX_SUMMARY = 200;

/**
 * Why the panel would refuse this experiment, or `null`. The panel judges the
 * event whole, so one bad experiment would lose the brand's declaration:
 * it is left out instead, and said so at start.
 */
export function declarationProblem(key: string, spec: DeclaredExperiment, summary: string | undefined): string | null {
  if (!KEY.test(key)) return "the key is not [a-z0-9_]{1,64}";
  if (spec.variants.length < 2) return "fewer than two variants";
  if (new Set(spec.variants).size !== spec.variants.length) return "a variant is declared twice";
  if (!spec.variants.every(v => EXPERIMENT_SLUG.test(v))) return "a variant is not a slug ([a-z0-9_-]{1,32})";
  if (spec.holdout !== undefined && !(Number.isFinite(spec.holdout) && spec.holdout >= 0 && spec.holdout < 1)) return "the holdout is not in [0, 1)";
  if (summary !== undefined && summary.length > MAX_SUMMARY) return `the summary is over ${MAX_SUMMARY} characters`;
  return null;
}

/** RFC 9562 UUIDv7: the panel refuses any other version for an event id. */
export function uuidV7(nowMs: number): string {
  const bytes = randomBytes(16);
  let ms = nowMs;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface DeclarationContext {
  brandId: string;
  /** The key id the batch is signed with: the panel refuses any other `source.id`. */
  sourceId: string;
  at: Date;
  /** One line of hypothesis per key, at most 200 characters. */
  summaries?: Readonly<Record<string, string>>;
}

/**
 * The ingest body declaring the brand's experiments, and what was left out of
 * it with why. A fresh UUIDv7 each call: every start is a declaration of its
 * own, and the panel keeps the latest by `occurredAt`.
 */
export function experimentsDeclaredBody(
  experiments: ExperimentsDeclaration,
  ctx: DeclarationContext,
): { body: { events: [ExperimentsDeclaredEvent] }; skipped: { key: string; why: string }[] } {
  const declared: ExperimentDeclarationV1[] = [];
  const skipped: { key: string; why: string }[] = [];
  for (const [key, spec] of Object.entries(experiments)) {
    const summary = ctx.summaries && Object.hasOwn(ctx.summaries, key) ? ctx.summaries[key] : undefined;
    const why = declarationProblem(key, spec, summary);
    if (why !== null) {
      skipped.push({ key, why });
      continue;
    }
    declared.push({
      key,
      variants: [...spec.variants],
      weights: spec.variants.map(() => 1),
      enabled: spec.enabled ?? true,
      ...(spec.holdout !== undefined ? { holdout: spec.holdout } : {}),
      ...(summary !== undefined && summary !== "" ? { summary } : {}),
    });
  }
  const event: ExperimentsDeclaredEvent = {
    id: uuidV7(ctx.at.getTime()),
    schema: "sa.funnel.v1",
    type: "experiments.declared",
    typeVersion: 1,
    occurredAt: ctx.at.toISOString(),
    source: { kind: "site", id: ctx.sourceId },
    subject: { brandId: ctx.brandId },
    properties: { experiments: declared },
  };
  return { body: { events: [event] }, skipped };
}

/** What `declareExperiments` did: queued (`row`), or why not. */
export type DeclareOutcome = { kind: "queued"; row: number; skipped: { key: string; why: string }[] } | { kind: "off" } | { kind: "failed" };

export interface DeclareOptions {
  summaries?: Readonly<Record<string, string>>;
  log?: Pick<Console, "warn" | "error">;
}

/**
 * Tells the panel which experiments this build runs — for `instrumentation.ts`
 * `register()`, once per start:
 *
 * ```ts
 * export async function register() {
 *   if (process.env.NEXT_RUNTIME !== "nodejs") return;
 *   declareExperiments(webhook, experiments, { summaries: { hero: "A shorter form converts better" } });
 * }
 * ```
 *
 * Queued in the lead webhook's outbox, signed and retried like a lead, and
 * sent at once. It never throws and never holds the start: a webhook that is
 * off (no `LEAD_WEBHOOK_URL`) or cannot be built is logged and skipped — the
 * panel keeps the brand's last declaration. An experiment the panel would
 * refuse is left out, logged.
 */
export function declareExperiments(
  webhook: () => LeadWebhook | null,
  experiments: ExperimentsDeclaration,
  options: DeclareOptions = {},
): DeclareOutcome {
  const log = options.log ?? console;
  let hook: LeadWebhook | null;
  try {
    hook = webhook();
  } catch (error) {
    log.error("experiments: the lead webhook could not be built, nothing declared to the panel", error);
    return { kind: "failed" };
  }
  if (!hook?.declareExperiments) return { kind: "off" };
  let outcome: DeclareOutcome;
  try {
    outcome = hook.declareExperiments(experiments, options.summaries ?? {});
  } catch (error) {
    log.error("experiments: the declaration could not be queued", error);
    return { kind: "failed" };
  }
  if (outcome.kind === "queued") {
    for (const { key, why } of outcome.skipped) log.error(`experiments: ${key} is not declared to the panel: ${why}`);
    hook.tick().catch((error: unknown) => log.error("experiments: sending the declaration failed; the outbox retries it", error));
  }
  return outcome;
}
