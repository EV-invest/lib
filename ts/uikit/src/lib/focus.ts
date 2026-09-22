/**
 * The focus indicator for a control that paints a fill (lib#129): the solid
 * ring standing 2px off the control instead of the kit's 50 % halo. The class
 * tables that paint a fill already carry it (`rust/classes/src/focus.rs` says
 * why); this is for a filled control of the caller's own.
 */
export { FILLED_FOCUS_RING } from "../generated/focus";
