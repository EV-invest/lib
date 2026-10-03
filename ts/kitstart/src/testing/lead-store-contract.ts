import { describe, expect, it } from "vitest";
import { LEAD_SCHEMA_VERSION, type Lead, type LeadStore } from "../core/lead";

/**
 * What every `LeadStore` adapter promises the funnel, whatever it keeps leads
 * in. An adapter passes this suite before `LEADS_DB_URL` may select it.
 *
 * `open` gets a fresh, empty store; `reopen` (durable adapters) a second
 * handle on the same data after the first was closed.
 */
export interface LeadStoreHarness {
  open(): Promise<LeadStore>;
  reopen?(): Promise<LeadStore>;
}

const lead = (over: Partial<Lead> = {}): Lead => ({
  subject: "blocked_drain",
  locality: "63130",
  mobile: "06 12 34 56 78",
  extras: {},
  placeSlug: "royat",
  spamVerdict: null,
  ...over,
});

export function describeLeadStoreContract(name: string, harness: () => LeadStoreHarness): void {
  describe(`LeadStore contract: ${name}`, () => {
    it("answers each insert with a new, increasing id, and counts what it holds", async () => {
      const store = await harness().open();
      expect(await store.count()).toBe(0);
      const first = await store.insert(lead());
      const second = await store.insert(lead({ placeSlug: null, spamVerdict: "honeypot" }));
      expect(second).toBeGreaterThan(first);
      expect(await store.count()).toBe(2);
      await store.close();
    });

    it("takes every shape the funnel produces: no place, a verdict, extras, a long value, a callback", async () => {
      const store = await harness().open();
      for (const variant of [
        lead({ placeSlug: null }),
        lead({ spamVerdict: "too-fast" }),
        lead({ spamVerdict: "rate-limited", extras: { surface_m2: "40", notes: "3e étage, digicode 12B" } }),
        lead({ subject: "x".repeat(200), locality: "Clermont-Ferrand — 63000" }),
        lead({ channel: "callback", subject: "", locality: "", consent: { text: "J’accepte d’être rappelé·e.", at: "2026-10-03T10:00:00.000Z" } }),
        lead({ channel: "callback", consent: { text: "x".repeat(500), at: "2026-10-03T10:00:00.000Z" } }),
      ]) {
        expect(await store.insert(variant)).toBeGreaterThan(0);
      }
      expect(await store.count()).toBe(6);
      await store.close();
    });

    it("stands at the current schema version and reports itself healthy", async () => {
      const store = await harness().open();
      expect(await store.schemaVersion()).toBe(LEAD_SCHEMA_VERSION);
      await expect(store.health()).resolves.toBeUndefined();
      await store.close();
    });

    // LEAD-FORMS-REVIEW-2026-10-03 #3: a resend after a lost answer is the same lead.
    it("keeps one row per submission id, and finds it back", async () => {
      const store = await harness().open();
      if (!store.findSubmission) return void (await store.close());
      const sid = "3f2b8c1e-5d4a-4f6b-9c7e-1a2b3c4d5e6f";
      const first = await store.insert(lead({ submissionId: sid, channel: "callback", consent: { text: "Oui.", at: "2026-10-03T10:00:00.000Z" }, extras: { name: "Ana" } }));
      await expect(store.insert(lead({ submissionId: sid }))).rejects.toThrow();
      expect(await store.count()).toBe(1);
      expect(await store.findSubmission(sid)).toEqual({
        id: first,
        lead: lead({ submissionId: sid, channel: "callback", consent: { text: "Oui.", at: "2026-10-03T10:00:00.000Z" }, extras: { name: "Ana" } }),
      });
      expect(await store.findSubmission("00000000-0000-4000-8000-000000000000")).toBeNull();
      // Leads without one (the no-JS post) never collide.
      await store.insert(lead());
      await store.insert(lead());
      expect(await store.count()).toBe(3);
      await store.close();
    });

    it("keeps what it acknowledged across a close and a reopen", async () => {
      const h = harness();
      if (!h.reopen) return;
      const store = await h.open();
      await store.insert(lead());
      await store.close();
      const again = await h.reopen();
      expect(await again.count()).toBe(1);
      expect(await again.schemaVersion()).toBe(LEAD_SCHEMA_VERSION);
      await again.close();
    });
  });
}
