import "server-only";
import { mergeLive, parsePlaceLive } from "../core/place/live";
import type { Place } from "../core/place/types";
import type { Site } from "../core/site";

/**
 * The live half of each place: `GET <base>/locations/<slug>?locale=<l>`,
 * merged over the baked config.
 *
 * The invariant that shapes it: pages are cached (ISR), and under ISR a cold
 * render that throws is Next's bare-text `Internal Server Error` — no phone,
 * no error boundary. So a page's loader never throws on the source: a 5xx and
 * an unreachable source both serve the baked place (a warm page keeps its last
 * good render anyway). Only a 404 changes the answer — the place is gone. The
 * sitemap is the one strict reader: see `listPlaces`.
 */
export interface PlaceSourceOptions {
  /** The source's base URL, read when asked; `null` → the baked config only. */
  baseUrl: () => string | null;
  /**
   * TTL on the fetch itself, not on the page: a segment-level `revalidate`
   * does not reach an explicit `force-cache` fetch, which would then cache
   * forever. The source sees one request per place per window.
   */
  revalidateSeconds?: number;
  timeoutMs?: number;
  log?: Pick<Console, "error">;
}

export class PlaceSourceError extends Error {
  override readonly name = "PlaceSourceError";
}

export interface PlaceSource<L extends string> {
  /** One place, or `null` when it does not exist — the caller's `notFound()`. Never throws on the source. */
  getPlace(slug: string, locale: L): Promise<Place<L> | null>;
  /**
   * Every place the source still has (a 404 is a place it retired). `"page"`
   * stands on the baked places through an outage; `"sitemap"` throws, because
   * a sitemap that silently drops places tells a crawler they are gone, and a
   * 5xx tells it to keep its last copy.
   */
  listPlaces(locale: L, mode: "page" | "sitemap"): Promise<Place<L>[]>;
  /**
   * One place, strictly — for a sitemap, which lists one host's place and
   * must fail (a 5xx a crawler retries) rather than shrink. `null` only when
   * the source withdrew it.
   */
  getPlaceStrict(slug: string, locale: L): Promise<Place<L> | null>;
}

export const PLACE_REVALIDATE_SECONDS = 600;
const TIMEOUT_MS = 3_000;

type Fetched<L extends string> =
  | { kind: "live"; place: Place<L> }
  | { kind: "missing" }
  | { kind: "unreachable"; cause: unknown }
  | { kind: "failed"; status: number };

/** Next's extension of `fetch`'s init; plain `fetch` ignores it. */
type NextInit = RequestInit & { next: { revalidate: number } };

export function createPlaceSource<L extends string, P extends string>(site: Site<L, P>, options: PlaceSourceOptions): PlaceSource<L> {
  const revalidate = options.revalidateSeconds ?? PLACE_REVALIDATE_SECONDS;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const log = options.log ?? console;

  async function fetchOne(base: string, baked: Place<L>, locale: L): Promise<Fetched<L>> {
    const init: NextInit = { cache: "force-cache", next: { revalidate }, signal: AbortSignal.timeout(timeoutMs) };
    let response: Response;
    try {
      response = await fetch(`${base}/locations/${encodeURIComponent(baked.slug)}?locale=${locale}`, init);
    } catch (cause) {
      return { kind: "unreachable", cause };
    }
    // Withdrawn is the source's own word: a 410, or a 404 it answered in its
    // JSON. A bare 404 is as likely an ingress with no route yet — a failing
    // source, which keeps the baked place.
    if (response.status === 410) return { kind: "missing" };
    if (response.status === 404) {
      return response.headers.get("content-type")?.includes("application/json") ? { kind: "missing" } : { kind: "failed", status: 404 };
    }
    if (!response.ok) return { kind: "failed", status: response.status };
    try {
      return { kind: "live", place: mergeLive(baked, parsePlaceLive(await response.json(), site.i18n.locales)) };
    } catch (cause) {
      // A body that is not the source's shape is the source failing, not the place.
      return { kind: "unreachable", cause };
    }
  }

  const baked = (slug: string) => site.places.find(p => p.slug === slug);

  return {
    async getPlace(slug, locale) {
      const place = baked(slug);
      if (!place) return null;
      const base = options.baseUrl();
      if (!base) return place;
      const fetched = await fetchOne(base, place, locale);
      switch (fetched.kind) {
        case "live":
          return fetched.place;
        case "missing":
          return null;
        // The gate fields may be missing from the baked place — then the page
        // is served `noindex` until the source is back, never a 404 or a 500.
        case "unreachable":
          log.error(`live place ${slug}: source unreachable, serving baked`, fetched.cause);
          return place;
        case "failed":
          log.error(`live place ${slug}: source answered ${fetched.status}, serving baked`);
          return place;
      }
    },

    async getPlaceStrict(slug, locale) {
      const place = baked(slug);
      if (!place) return null;
      const base = options.baseUrl();
      if (!base) return place;
      const fetched = await fetchOne(base, place, locale);
      switch (fetched.kind) {
        case "live":
          return fetched.place;
        case "missing":
          return null;
        case "unreachable":
          throw new PlaceSourceError(`place ${slug} unreachable`, { cause: fetched.cause });
        case "failed":
          throw new PlaceSourceError(`place ${slug}: source answered ${fetched.status}`);
      }
    },

    async listPlaces(locale, mode) {
      const base = options.baseUrl();
      if (!base) return [...site.places];
      const results = await Promise.all(
        site.places.map(async (place): Promise<Place<L> | null> => {
          const fetched = await fetchOne(base, place, locale);
          switch (fetched.kind) {
            case "live":
              return fetched.place;
            case "missing":
              return null;
            case "unreachable":
              if (mode === "sitemap") throw new PlaceSourceError(`place list: ${place.slug} unreachable`, { cause: fetched.cause });
              return place;
            case "failed":
              if (mode === "sitemap") throw new PlaceSourceError(`place list: ${place.slug} answered ${fetched.status}`);
              return place;
          }
        }),
      );
      return results.filter((p): p is Place<L> => p !== null);
    },
  };
}
