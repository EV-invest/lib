import type { ReactNode } from "react";

/**
 * Props of {@link accented} / {@link Accented}: a translated string whose
 * accent words are marked with `*asterisks*` and whose line breaks are `\n`.
 *
 * Display headings often set one word apart ("Let's *talk*."). Splitting that
 * into two catalogue keys (lead + accent) hard-codes English word order: other
 * languages put the verb elsewhere, and a translator handed
 * `{lead} <em>{accent}</em>` cannot move it. One key with an inline marker lets
 * the sentence be rearranged freely and keeps the typography. The same goes for
 * the line break — where it falls depends on word length in the target
 * language.
 *
 * Deliberately not Markdown and not `dangerouslySetInnerHTML`: the only things
 * that need expressing are "this word is the accent" and "break here", and a
 * two-character convention keeps translator-authored strings inert.
 */
export interface AccentedProps {
  text: string;
  /** Class of every accent span. Tokens only — no brand fonts baked in. */
  className?: string;
  /**
   * One class per accent, in order, for headings that tint their accents
   * differently. Cycles if the string carries more accents than entries — a
   * translation with an extra accent renders in a real tone rather than
   * unstyled.
   */
  classNames?: readonly string[];
}

const DEFAULT_ACCENT = "italic text-primary-ink";

/**
 * The nodes themselves — call this inside `SplitText`.
 *
 * ## Why this returns a FLAT list
 *
 * `SplitText` tokenises `Children.toArray` and understands exactly two things:
 * bare strings (split into animatable words, remembering trailing spaces) and
 * `<br>` elements. Anything else is one opaque word token. Wrapping text in a
 * keyed `<Fragment>` would therefore run "Invest in" into the accent word and
 * hide the `<br>`, which then renders *inside* an `inline-block` as a two-line
 * box with a large gap. So strings stay strings and `<br>`s stay siblings;
 * React only needs keys on elements, not on strings.
 *
 * ## Why a function and not only `<Accented>`
 *
 * From a **client** component an `<Accented>` element is still unrendered when
 * `SplitText` inspects it: it becomes one opaque token (no per-word motion) and
 * the screen-reader copy finds no `children` to recurse into — the heading
 * announces as nothing. Calling the function inlines real children either way.
 */
export function accented({
  text,
  className = DEFAULT_ACCENT,
  classNames,
}: AccentedProps): ReactNode[] {
  const tones = classNames?.length ? classNames : [className];
  const out: ReactNode[] = [];

  // Each line its own node with real <br>s between, so `tokenize` sees both.
  // An empty segment contributes nothing — which is what makes "*Accent*
  // first" and a trailing "*Accent*" both come out right. A break inside an
  // accent becomes a sibling <br> between two accent spans, never a <br>
  // inside one: `SplitText` keeps a span whole as one inline-block, where a
  // nested break renders as a two-line box.
  const pushLines = (part: string, key: string, tone?: string) => {
    part.split("\n").forEach((line, j) => {
      if (j > 0) out.push(<br key={`${key}-b${j}`} />);
      if (line === "") return;
      out.push(
        tone === undefined ? (
          line
        ) : (
          <span key={`${key}-${j}`} className={tone}>
            {line}
          </span>
        ),
      );
    });
  };

  // Odd indices are the marked segments: "a *b* c" → ["a ", "b", " c"].
  const parts = text.split("*");
  // An odd number of `*` leaves the last one unpaired. A translator's typo
  // (or a literal "5*") must not accent the rest of the heading, so the
  // unpaired `*` stays text.
  if (parts.length % 2 === 0) {
    const tail = parts.pop() ?? "";
    parts.push(`${parts.pop() ?? ""}*${tail}`);
  }

  parts.forEach((part, i) => {
    if (i % 2 === 1) pushLines(part, `a${i}`, tones[((i - 1) / 2) % tones.length]);
    else pushLines(part, `p${i}`);
  });

  return out;
}

/** JSX wrapper over {@link accented}, for headings that are not split. */
export function Accented(props: AccentedProps): ReactNode {
  return accented(props);
}
