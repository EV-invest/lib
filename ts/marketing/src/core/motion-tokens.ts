// Motion tokens — the design-system half of `motion`. Every animation a
// marketing surface runs picks its curve and duration from here, the same way
// colour picks from the uikit tokens: one place to retune the feel of a whole
// site, and no per-component easing invented on the spot. If a value is
// missing, add it here rather than inlining one.
//
// Plain data with no `"use client"`, so a Server Component can compute a
// `delay={STAGGER * i}` without importing a client reference.
//
// The house curve is a strong ease-out: motion that decelerates into place and
// never overshoots, bounces, or draws attention to itself.

/** Cubic-bezier control points, in the shape `motion` wants them. */
export const EASE = {
  /** Default. Fast start, long settle — used for every entrance. */
  out: [0.22, 1, 0.36, 1],
  /** Symmetric; for state changes that reverse (open ⇄ close). */
  inOut: [0.65, 0, 0.35, 1],
  /** Exits: leave quickly, don't linger. */
  in: [0.55, 0, 1, 0.45],
} as const;

/** Seconds. Anything longer than `slow` reads as the page being stuck. */
export const DUR = {
  fast: 0.22,
  base: 0.45,
  slow: 0.7,
} as const;

/** Pixels a revealing element travels. Small — the fade carries the effect. */
export const RISE = 16;

/**
 * Starting opacity of a `Settle`: the element is on screen from the first
 * frame and only firms up. Above ~0.5 the browser still counts it as an LCP
 * candidate and a reader never sees an empty slot where a control belongs;
 * below 1 the settle still registers as motion. Never 0 — that is a `Reveal`.
 */
export const SETTLE_OPACITY = 0.6;

/**
 * Seconds between siblings in a staggered group. Tuned so a 4-up grid finishes
 * within `DUR.slow` of its first child: past ~8 items, prefer two groups over a
 * longer tail.
 */
export const STAGGER = 0.07;

/** Per-token delay inside a split headline — tighter than a card stagger. */
export const STAGGER_TEXT = 0.045;

/**
 * The viewport margin that triggers a scroll reveal: fire slightly *before* the
 * element is fully on screen so the motion has finished by the time the reader's
 * eye arrives. A reveal the reader watches start is a reveal that felt slow.
 *
 * `once: true` is the point: a section that re-animates every time it scrolls
 * back into view reads as broken.
 */
export const VIEWPORT = { once: true, margin: "-80px" } as const;

/**
 * {@link VIEWPORT} with the horizontal inset removed — for anything narrower
 * than the page.
 *
 * A viewport margin shrinks the observer's root on ALL FOUR sides. On a
 * full-width block the left/right inset is invisible, which is why `VIEWPORT`
 * gets away with a single number. On a small element pinned near a screen edge
 * it is fatal and silent: at 390px the root's right edge lands at x=310, so a
 * label occupying x=310-350 never intersects, never "enters view", and any
 * entrance keyed to it never runs. Nothing throws — the element simply sits at
 * its initial state forever, which for a counter means it reads zero.
 *
 * The vertical inset is the half doing real work (fire just before the element
 * is fully on screen), so it stays.
 */
export const VIEWPORT_Y = { once: true, margin: "-80px 0px" } as const;

/**
 * {@link VIEWPORT_Y} without `once` — the observer keeps reporting, so a value
 * derived from it goes false again when the element leaves.
 *
 * This exists for *looping* ambience (a pulse travelling a line, a breathing
 * marker). An `Infinity` repeat never ends on its own, so it must be gated on
 * something that can turn it off: left running off-screen it burns a phone's
 * battery for a picture nobody is looking at. Entrances keep using the `once`
 * variants — re-firing a reveal every time the reader scrolls back is a
 * different bug.
 */
export const VIEWPORT_LIVE = { margin: "-80px 0px" } as const;
