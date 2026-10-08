// How `FieldLabel` tells a kit control from any other component without
// importing it: each control marks itself in its own module. Recognising them
// by identity meant `field.tsx` imported every control, so a page with one
// `Field` and an `Input` still shipped the whole `Select` (floating, portal,
// focus scope, listbox — ~4 KB gz).
//
// `Symbol.for`, not `Symbol`: two copies of the kit in one app (a hoisting
// accident) still read each other's marks.
const LABELABLE = Symbol.for("@evinvest/uikit/labelable@1");

/** Marks a component that renders one labelable element and takes its `Field`'s id. */
export function markLabelable(component: object): void {
  Object.defineProperty(component, LABELABLE, { value: true });
}

/** Whether an element `type` is a component marked with `markLabelable`. */
export function isLabelable(type: unknown): boolean {
  return (typeof type === "function" || (typeof type === "object" && type !== null)) && Reflect.get(type, LABELABLE) === true;
}
