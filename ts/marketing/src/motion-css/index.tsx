/**
 * `@evinvest/marketing/motion-css` — the motion primitives with **no
 * JavaScript**: the same names and the same props as `./motion`, rendered as
 * plain markup that `@evinvest/marketing/motion.css` animates.
 *
 * No `"use client"`, no hooks: these are Server Components. A page built on
 * them ships zero bytes of animation runtime, where `./motion` costs ~30 KB gz
 * of `motion` plus hydrating every animated block.
 *
 * What CSS gives up, knowingly:
 *
 * - **Scroll reveals are scroll-linked, not once.** They run on
 *   `animation-timeline: view()`: progress follows the element through the
 *   viewport, so scrolling back up reverses it. Where the browser has no
 *   scroll timelines (Firefox today) the block is simply shown — never stuck
 *   hidden, because the hidden state exists only inside the keyframes. Their
 *   `delay` and `duration` are ignored: scroll position, not time, drives them.
 * - **`CountUp` does not count.** It renders the final figure, which is what
 *   the JS version renders on the server anyway.
 * - **Stagger numbers direct children only.** A `StaggerItem` wrapped in
 *   another element or a fragment-returning component is not counted (the JS
 *   engine's variants reach any depth).
 * - **Only the shared props.** `motion`-specific props (`whileHover`,
 *   `variants`, `transition`, `MotionValue`s in `style`, …) are dropped, not
 *   written to the DOM; plain DOM attributes pass through.
 *
 * Swap engines per site with `withMotionEngine` from
 * `@evinvest/marketing/next`, importing the primitives from
 * `@evinvest/marketing/motion` in app code.
 */
import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

import { DUR, RISE, STAGGER, STAGGER_TEXT } from "../core/motion-tokens";
import { flattenText, tokenize } from "../core/tokenize";

/** Custom properties are not in `CSSProperties`; this is the one cast. */
type Vars = CSSProperties & Record<`--${string}`, string | number>;

const ms = (seconds: number) => `${Math.round(seconds * 1000)}ms`;

type DivProps = Omit<HTMLAttributes<HTMLDivElement>, "style"> & { style?: CSSProperties };

/**
 * Props that mean something only to `motion`. App code is typed against the
 * JS engine (the alias swaps modules at bundle time, not types), so a
 * `whileHover` or a `transition` can reach these components; passed on, React
 * writes them to the DOM as bogus attributes and warns.
 */
const MOTION_ONLY =
  /^(initial|animate|exit|transition|variants|viewport|custom|inherit|layout|layoutId|layoutDependency|layoutScroll|layoutRoot|transformTemplate|drag|dragConstraints|dragElastic|dragMomentum|dragTransition|dragSnapToOrigin|dragListener|dragControls|dragPropagation|dragDirectionLock|while[A-Z]\w*|on(Animation(Start|Complete)|Update|LayoutAnimation\w*|Hover(Start|End)|Tap(Start|Cancel)?|Pan(Start|End)?|Drag(Start|End|Transition\w*)?|Direction\w*|ViewportEnter|ViewportLeave|BeforeLayoutMeasure|LayoutMeasure))$/;

/** A `MotionValue` in `style` is an object with `get`; the DOM wants a plain value. */
const isMotionValue = (v: unknown) => typeof v === "object" && v !== null && typeof (v as { get?: unknown }).get === "function";

/** The props with everything only `motion` understands removed. */
function domProps<P extends { style?: CSSProperties }>(props: P): P {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!MOTION_ONLY.test(key)) out[key] = value;
  }
  if (props.style) {
    out["style"] = Object.fromEntries(Object.entries(props.style).filter(([, v]) => !isMotionValue(v)));
  }
  return out as P;
}

/** Where the element travels *from*. `none` is a pure fade. */
export type RevealFrom = "up" | "down" | "left" | "right" | "none";

function from(direction: RevealFrom, distance: number): Vars {
  switch (direction) {
    case "up":
      return { "--ev-from-y": `${distance}px` };
    case "down":
      return { "--ev-from-y": `${-distance}px` };
    case "left":
      return { "--ev-from-x": `${distance}px` };
    case "right":
      return { "--ev-from-x": `${-distance}px` };
    case "none":
      return {};
  }
}

export interface RevealProps extends DivProps {
  delay?: number;
  from?: RevealFrom;
  distance?: number;
  duration?: number;
  onMount?: boolean;
}

/** A fade plus a short rise — on mount, or tied to the element entering view. */
export function Reveal({
  delay = 0,
  from: direction = "up",
  distance = RISE,
  duration = DUR.slow,
  onMount = false,
  style,
  children,
  ...props
}: RevealProps) {
  const vars: Vars = { ...from(direction, distance), "--ev-dur": ms(duration), "--ev-delay": ms(delay) };
  return (
    <div data-ev-motion={onMount ? "mount" : "view"} {...domProps({ ...props, style: { ...vars, ...style } })}>
      {children}
    </div>
  );
}

export interface SettleProps extends DivProps {
  duration?: number;
}

/** Already there on first paint, and only firms up: from 0.6 opacity and half a rise. */
export function Settle({ duration = DUR.base, style, children, ...props }: SettleProps) {
  const vars: Vars = { "--ev-dur": ms(duration) };
  return (
    <div data-ev-motion="settle" {...domProps({ ...props, style: { ...vars, ...style } })}>
      {children}
    </div>
  );
}

export interface StaggerProps extends DivProps {
  delay?: number;
  step?: number;
  onMount?: boolean;
}

export interface StaggerItemProps extends DivProps {
  distance?: number;
  /** Set by the parent {@link Stagger}; never pass it by hand. */
  index?: number;
}

/**
 * A row whose {@link StaggerItem}s arrive in sequence. The parent numbers its
 * items (`--ev-i`) instead of each child computing a delay, so reordering a
 * card keeps the cascade right — the same contract as the JS `Stagger`.
 */
export function Stagger({ delay = 0, step = STAGGER, onMount = false, style, children, ...props }: StaggerProps) {
  let i = 0;
  const numbered = Children.map(children, child => {
    if (!isValidElement(child) || child.type !== StaggerItem) return child;
    return cloneElement(child as ReactElement<StaggerItemProps>, { index: i++ });
  });
  const vars: Vars = { "--ev-delay": ms(delay), "--ev-step": ms(step) };
  return (
    <div data-ev-stagger={onMount ? "mount" : "view"} {...domProps({ ...props, style: { ...vars, ...style } })}>
      {numbered}
    </div>
  );
}

/** One member of a {@link Stagger}; its timing comes from the parent. */
export function StaggerItem({ distance = RISE, index = 0, style, children, ...props }: StaggerItemProps) {
  const vars: Vars = { "--ev-from-y": `${distance}px`, "--ev-i": index };
  return (
    <div data-ev-motion="item" {...domProps({ ...props, style: { ...vars, ...style } })}>
      {children}
    </div>
  );
}

export interface SplitTextProps {
  children: ReactNode;
  delay?: number;
  step?: number;
  inView?: boolean;
  className?: string;
}

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

/**
 * A display headline assembling word by word. Same accessibility contract as
 * the JS version: the words are `aria-hidden`, the sentence is a
 * visually-hidden text node.
 */
export function SplitText({ children, delay = 0, step = STAGGER_TEXT, inView = false, className }: SplitTextProps) {
  const vars: Vars = { "--ev-delay": ms(delay), "--ev-step": ms(step), "--ev-dur": ms(DUR.base) };
  let i = 0;
  return (
    <span className={className} data-ev-stagger={inView ? "view" : "mount"} style={vars}>
      <span style={VISUALLY_HIDDEN}>{flattenText(children)}</span>
      {tokenize(children).map((token, key) =>
        token.kind === "break" ? (
          <br key={key} aria-hidden />
        ) : (
          <Fragment key={key}>
            <span aria-hidden data-ev-motion="word" style={{ "--ev-i": i++ } as Vars}>
              {token.node}
            </span>
            {token.space ? " " : null}
          </Fragment>
        ),
      )}
    </span>
  );
}

export interface CountUpProps {
  value: number;
  locale: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Accepted for parity with the JS version; CSS does not count. */
  duration?: number;
  /** Accepted for parity with the JS version; CSS does not count. */
  delay?: number;
  className?: string;
}

/** The final figure, formatted — what the JS `CountUp` renders before it runs. */
export function CountUp({ value, locale, decimals = 0, prefix = "", suffix = "", className }: CountUpProps) {
  const nf = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span className={className}>{`${prefix}${nf.format(value)}${suffix}`}</span>;
}
