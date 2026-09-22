/**
 * The focus indicator for a control that paints a fill (lib#129). The kit's
 * default — a 3px halo of the ring at 50 % — composites to ~2:1 against the
 * surface and all but vanishes into a teal fill. This one is the solid ring
 * standing 2px off the control, so the surface shows between the two: the ring
 * is only ever measured against the surface and the fill against the surface,
 * both of which `test/tokens.test.ts` holds at 3:1 on every palette.
 *
 * `outline-solid` is spelled out because `outline-none` on the base class
 * leaves the outline style at `none`, and a width alone would paint nothing.
 */
export const FILLED_FOCUS_RING =
  "focus-visible:ring-0 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
