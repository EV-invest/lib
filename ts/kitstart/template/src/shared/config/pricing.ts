import type { PricingModel } from "@evinvest/kitstart";

/**
 * The baked price list: what `recurring` is priced from until the panel
 * serves one (`GET <LOCATIONS_API_URL>/pricing`), and whenever it is down.
 * OWNER_TODO: placeholder amounts — the owner sets the real ones in the panel.
 */
export const PRICING: PricingModel = {
  format: 1,
  currency: "EUR",
  validFrom: "2026-10-01",
  roundToCents: 100,
  minimumCents: 4900,
  inputs: [
    {
      id: "bedrooms",
      kind: "add",
      labels: { fr: "Chambres", en: "Bedrooms" },
      options: [
        { id: "studio", labels: { fr: "Studio", en: "Studio" }, addCents: 0 },
        { id: "t2", labels: { fr: "1 chambre", en: "1 bedroom" }, addCents: 1500 },
        { id: "t3", labels: { fr: "2 chambres", en: "2 bedrooms" }, addCents: 3000 },
        { id: "t4", labels: { fr: "3 chambres et plus", en: "3 bedrooms or more" }, addCents: 4500 },
      ],
    },
    {
      id: "surface",
      kind: "add",
      labels: { fr: "Surface", en: "Floor area" },
      options: [
        { id: "s40", labels: { fr: "Moins de 40 m²", en: "Under 40 m²" }, addCents: 0 },
        { id: "s70", labels: { fr: "40 à 70 m²", en: "40 to 70 m²" }, addCents: 1000 },
        { id: "s70p", labels: { fr: "Plus de 70 m²", en: "Over 70 m²" }, addCents: 2500 },
      ],
    },
    {
      id: "frequency",
      kind: "discount",
      labels: { fr: "Fréquence", en: "How often" },
      options: [
        { id: "weekly", labels: { fr: "Chaque semaine", en: "Every week" }, discountBp: 1500 },
        { id: "biweekly", labels: { fr: "Toutes les 2 semaines", en: "Every 2 weeks" }, discountBp: 1000 },
        { id: "monthly", labels: { fr: "Chaque mois", en: "Every month" }, discountBp: 500 },
        { id: "once", labels: { fr: "Une fois", en: "Once" }, discountBp: 0 },
      ],
    },
  ],
  needs: { recurring: { kind: "estimate", baseCents: 4500, inputs: ["bedrooms", "surface", "frequency"] } },
};
