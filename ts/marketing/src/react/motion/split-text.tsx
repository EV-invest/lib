import { Fragment, type CSSProperties, type ReactNode } from "react";
import { motion } from "motion/react";

import { DUR, EASE, STAGGER_TEXT, VIEWPORT } from "../../core/motion-tokens";
import { flattenText, tokenize } from "../../core/tokenize";
import { useReduceMotion } from "./reduced-motion";

export interface SplitTextProps {
  children: ReactNode;
  /** Seconds before the first word moves. */
  delay?: number;
  /** Seconds between words. Default {@link STAGGER_TEXT}. */
  step?: number;
  /** Animate on scroll instead of on mount. Use below the fold. */
  inView?: boolean;
  className?: string;
}

// Inline styles, not utility classes: the package must not depend on the
// consumer's Tailwind scanning this bundle for a headline to stay accessible.
const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

// `inline-block` is what makes the transform apply at all — an inline box
// ignores `translate`. Wrapping still works because the separators between
// words are real text nodes.
const WORD_STYLE = { display: "inline-block", willChange: "transform" } as const;

const WORD = {
  hidden: { opacity: 0, y: "0.45em" },
  shown: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.base, ease: EASE.out },
  },
};

/**
 * Headline motion: each word rises into place a beat after the last, so the
 * line assembles left-to-right instead of appearing whole. For **display type
 * only** — word-staggering body copy makes it unreadable while it settles.
 *
 * It takes rich children, not a string: accent spans and `<br />`s must
 * survive. Bare strings split into words and every element stays one token, so
 * markup and animation stay independent (see `accented` for the flat-list
 * contract this relies on).
 *
 * Accessibility: the word spans are `aria-hidden`, and the sentence is
 * reassembled into a visually-hidden sibling. NOT an `aria-label` on the
 * wrapper — a bare `span` maps to the `generic` role, where `aria-label` is not
 * reliably exposed, and the heading would announce as empty. A real text node
 * cannot be ignored. Do not strip it.
 */
export function SplitText({
  children,
  delay = 0,
  step = STAGGER_TEXT,
  inView = false,
  className,
}: SplitTextProps) {
  const reduce = useReduceMotion();

  // Reduced motion: one fade for the whole line. Splitting would still move
  // every word, which is the thing the preference asks us not to do.
  if (reduce) {
    return (
      <motion.span
        className={className}
        data-motion="fade"
        initial={{ opacity: 0 }}
        {...(inView
          ? { whileInView: { opacity: 1 }, viewport: VIEWPORT }
          : { animate: { opacity: 1 } })}
        transition={{ duration: DUR.base, ease: EASE.out, delay }}
      >
        {children}
      </motion.span>
    );
  }

  return (
    <motion.span
      className={className}
      data-motion="split"
      initial="hidden"
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: step, delayChildren: delay } },
      }}
      {...(inView
        ? { whileInView: "shown", viewport: VIEWPORT }
        : { animate: "shown" })}
    >
      <span style={VISUALLY_HIDDEN}>{flattenText(children)}</span>
      {tokenize(children).map((token, i) =>
        token.kind === "break" ? (
          <br key={i} aria-hidden />
        ) : (
          <Fragment key={i}>
            <motion.span aria-hidden variants={WORD} style={WORD_STYLE}>
              {token.node}
            </motion.span>
            {token.space ? " " : null}
          </Fragment>
        ),
      )}
    </motion.span>
  );
}
