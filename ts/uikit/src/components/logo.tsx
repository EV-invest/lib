import * as React from "react";
import { cn } from "../lib/cn";

/**
 * The consumer's mark, painted as a CSS mask (`backgroundColor: currentColor` +
 * `maskImage`) so a monochrome lockup follows the surrounding text colour
 * instead of the artwork's baked-in fill. `withBackground` seats it on the brand
 * field, keeping a chip consistent with a favicon.
 *
 * The kit ships no artwork. The mark is a design token like every colour: the
 * consumer declares `--brand-mark` — a `url()` at its own asset — and
 * `--brand-aspect` in the same sheet it declares the palette in (see
 * `styles/tokens.css`). Undeclared, `maskImage` is invalid at computed-value time
 * and the span paints as a solid block: loud, and nobody else's logo.
 *
 * Decorative by design (`aria-hidden`): every real call site has the brand name
 * in adjacent text or on the wrapping link, and a mark announced twice is worse
 * than one announced once.
 */
export interface LogoProps {
  className?: string;
  withBackground?: boolean;
}

const maskStyle: React.CSSProperties = {
  backgroundColor: "currentColor",
  maskImage: "var(--brand-mark)",
  WebkitMaskImage: "var(--brand-mark)",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskPosition: "center",
  WebkitMaskPosition: "center",
  maskSize: "contain",
  WebkitMaskSize: "contain",
  // the ratio's fallback is what makes a missing mark *visible*: a masked span
  // has no intrinsic size, so `h-N w-auto` without it is zero-width
  aspectRatio: "var(--brand-aspect, 1)",
};

export function Logo({ className, withBackground = false }: LogoProps) {
  const mark = (
    <span
      data-slot="logo"
      aria-hidden
      style={maskStyle}
      className={cn("inline-block", withBackground ? "w-3/5 h-3/5" : className)}
    />
  );

  if (!withBackground) return mark;

  return (
    <span
      data-slot="logo-background"
      className={cn("inline-flex items-center justify-center bg-brand", className)}
    >
      {mark}
    </span>
  );
}
