import type { CopySlice, CoreText, Said as CoreSaid } from "@evinvest/kitstart";
import type { Locale } from "@/shared/config/i18n";
import type { Subject } from "@/shared/config/lead";
import type { PageKey } from "@/shared/config/site";

/**
 * The facts a sentence may quote. Prose that names the phone or the place
 * takes them as an argument, so the number in the sentence and the number on
 * the card are one field.
 */
export interface Facts {
  place: string;
  /** `null` until the card has a phone. */
  phone: string | null;
}

export type Said = CoreSaid<Facts>;

/**
 * Every string that differs between languages. It extends `CoreText`, the
 * words the machinery prints; the rest is this brand's own sections. `FR` and
 * `EN` are checked with `satisfies Text`, so a key in one and not the other is
 * a compile error.
 */
export interface Text extends CoreText<PageKey, Facts> {
  hero: { title: Said; lede: string };
  /** The apex of a network of places: its `<head>` and the directory's link. */
  brandPage: { title: string; description: string; open: string };
  /** The contact bar's accessible name. */
  contactLabel: string;
  coverageTitle: string;
  subjects: Record<Subject, string>;
  quoteLabels: { subject: string; locality: string; mobile: string };
  faqs: readonly { q: string; a: string }[];
}

export type Copy = CopySlice<Locale, Text, Facts>;
