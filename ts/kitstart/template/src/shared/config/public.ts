import { cardFact } from "@evinvest/kitstart";

/**
 * The brand facts a client component may know — the error boundary prints
 * the name and the phone, and must not import the whole site config (and its
 * places) to do it. Inlined at build from `assets/card.toml`.
 */
export const BRAND_PUBLIC = {
  name: "Brand",
  phone: cardFact("SITE_CARD_PHONE", process.env.SITE_CARD_PHONE),
} as const;
