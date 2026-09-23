/**
 * The copy contract the machinery reads. A brand's `Text` extends
 * `CoreText` and adds everything its own sections say; a shared widget takes
 * only its slice (`StatusCopy`, `QuoteFormCopy`, `PageMetaCopy`…), so a brand
 * can reword its hero without the status screen's type noticing, and a
 * widget's signature says which words it can print.
 *
 * `F` is the brand's facts — the phone, the place, the prices a sentence may
 * quote. Prose that quotes a fact takes it as an argument instead of spelling
 * it out, so the number in the sentence and the number on the card are one.
 */

/** A sentence that quotes a fact. */
export type Said<F> = (f: F) => string;

/** What `<head>`, the OG card and the breadcrumbs read for one page. */
export interface PageMetaCopy<F> {
  /** `<title>`, the OG title and the breadcrumb label. */
  title: Said<F>;
  /** Read by `<head>`, the OG card and the sitemap — one field, three readers. */
  description: Said<F>;
}

export type StatusAction = "call" | "home" | "retry";

/** The 404, the 500 and the post-submit confirmation. */
export interface StatusCopy<F> {
  code: string;
  /** The `<title>`: these pages are `noindex` and carry no page meta. */
  title: string;
  eyebrow: string;
  /** Split at the accented half, which is how the design draws it. */
  headline: readonly [string, string];
  body: Said<F>;
  primary: StatusAction;
  secondary: StatusAction;
}

/** The quote form's frame; the fields a brand asks for label themselves. */
export interface QuoteFormCopy<F> {
  title: string;
  lede: string;
  submit: string;
  privacy: string;
  reassurance: Said<F>;
  /** The honeypot's label — read only by a bot filling every field. */
  honeypotLabel: string;
}

/** Every string the shared machinery prints, per language. */
export interface CoreText<P extends string, F> {
  pages: Record<P, PageMetaCopy<F>>;
  quoteForm: QuoteFormCopy<F>;
  notFound: StatusCopy<F>;
  serverError: StatusCopy<F>;
  thanks: StatusCopy<F>;
  /** The accessible name of every `tel:` link. */
  callLabel: Said<F>;
  whatsappLabel: string;
  /** The same channel where only a word fits. */
  whatsappShort: string;
  whatsappMessage: Said<F>;
  /** The one CTA label where only a word fits. */
  ctaShort: string;
  backHome: string;
  tryAgain: string;
  /** The offer's terms, compressed under a status screen. */
  statusStrip: readonly string[];
  langName: string;
  /**
   * The business's registration facts (SIRET, insurer…) as short items — the
   * status screen prints them under its offer strip.
   */
  facts: (f: F) => readonly string[];
}

/** What the status screen prints besides its own `StatusCopy`. */
export type StatusScreenText<F> = Pick<CoreText<string, F>, "callLabel" | "backHome" | "tryAgain" | "statusStrip" | "facts">;

/** What the mobile call bar prints. */
export type CallBarText<F> = Pick<CoreText<string, F>, "callLabel" | "whatsappMessage" | "whatsappShort" | "ctaShort">;

/**
 * What a widget needs to say something: the language, its slice of the words,
 * and the facts they quote. A brand's full `Copy` is assignable to any slice.
 */
export interface CopySlice<L extends string, T, F> {
  locale: L;
  t: T;
  f: F;
}
