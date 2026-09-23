import "server-only";
import { createPlaceSource, createServerEnv, leadNotifier, type LeadNotifier } from "@evinvest/kitstart/server";
import { site } from "./site";

/** Parsed once, lazily: `next build` imports this and must need no secrets. */
export const serverEnv = createServerEnv(site);

/** The live place data, when `LOCATIONS_API_URL` is set; baked otherwise. */
export const places = createPlaceSource(site, { baseUrl: () => serverEnv().locationsApiUrl });

let built: LeadNotifier | undefined;

/** Built at boot (`instrumentation.ts`), so SMTP with no sender fails startup. */
export function notifier(): LeadNotifier {
  built ??= leadNotifier(site, serverEnv());
  return built;
}
