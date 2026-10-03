import "server-only";
import type { PricingModel } from "../core/pricing/model";
import { parsePricingModel, pricingProblemsFor } from "../core/pricing/validate";
import type { Site } from "../core/site";
import { PLACE_REVALIDATE_SECONDS } from "./place-source";

/**
 * The brand's live price list: `GET <base>/pricing`, the whole model with a
 * label in every locale, over the baked one (`site.pricing`). The same
 * failure semantics as the place source, for the same reason — a page that
 * throws under ISR is a bare 500 with no phone: an unreachable source, a
 * non-200, a body that is not JSON, and a model that does not validate all
 * serve the baked model. Taken whole or not at all: a page never prices from
 * half a model. `{}` is the source's "nothing set": the baked model, quietly.
 */
export interface PricingSourceOptions {
  /** The source's base URL, read when asked; `null` → the baked model only. */
  baseUrl: () => string | null;
  /** TTL on the fetch itself (see `PlaceSourceOptions`); 600 s. */
  revalidateSeconds?: number;
  timeoutMs?: number;
  log?: Pick<Console, "error">;
}

export interface PricingSource {
  /** The model to price with now: live, else baked, else `null` (every need is a `quote`). Never throws. */
  model(): Promise<PricingModel | null>;
}

const TIMEOUT_MS = 3_000;

type NextInit = RequestInit & { next: { revalidate: number } };

const isEmptyObject = (v: unknown): boolean => typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0;

export function createPricingSource<L extends string, P extends string>(site: Site<L, P>, options: PricingSourceOptions): PricingSource {
  const revalidate = options.revalidateSeconds ?? PLACE_REVALIDATE_SECONDS;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const log = options.log ?? console;
  const baked = site.pricing ?? null;

  async function live(base: string): Promise<PricingModel | null> {
    const init: NextInit = { cache: "force-cache", next: { revalidate }, signal: AbortSignal.timeout(timeoutMs) };
    let response: Response;
    try {
      response = await fetch(`${base}/pricing`, init);
    } catch (cause) {
      log.error("pricing: source unreachable, pricing from the baked model", cause);
      return baked;
    }
    if (!response.ok) {
      log.error(`pricing: source answered ${response.status}, pricing from the baked model`);
      return baked;
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      log.error("pricing: the source's body is not JSON, pricing from the baked model", cause);
      return baked;
    }
    if (isEmptyObject(body)) return baked;
    const problems = pricingProblemsFor(body, site.i18n.locales);
    if (problems.length > 0) {
      log.error(`pricing: the source's model is refused whole (${problems.slice(0, 5).join("; ")}), pricing from the baked model`);
      return baked;
    }
    return parsePricingModel(body);
  }

  return {
    async model() {
      const base = options.baseUrl();
      return base ? live(base) : baked;
    },
  };
}
