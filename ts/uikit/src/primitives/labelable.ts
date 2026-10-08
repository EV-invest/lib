// How `FieldLabel` tells a kit control from any other component without
// importing it: each control marks itself in its own module. Recognising them
// by identity meant `field.tsx` imported every control, so a page with one
// `Field` and an `Input` still shipped the whole `Select` (floating, portal,
// focus scope, listbox — ~4 KB gz).
//
// `Symbol.for`, not `Symbol`: two copies of the kit in one app (a hoisting
// accident) still read each other's marks.
const LABELABLE = Symbol.for("@evinvest/uikit/labelable@1");
const LAZY = Symbol.for("react.lazy");

/** Marks a component that renders one labelable element and takes its `Field`'s id. */
export function markLabelable(component: object): void {
  Object.defineProperty(component, LABELABLE, { value: true });
}

/** Whether an element `type` is a component marked with `markLabelable`. */
export function isLabelable(type: unknown): boolean {
  const resolved = unwrapLazy(type);
  return (
    (typeof resolved === "function" || (typeof resolved === "object" && resolved !== null)) &&
    Reflect.get(resolved, LABELABLE) === true
  );
}

// An element a Server Component rendered reaches the client with a lazy type:
// the Flight client wraps every client reference in a `React.lazy`-shaped
// object, so the control's own function (and its mark) sits behind it. The
// mark cannot travel through the reference instead — the server holds only the
// module id, never the module. So resolve the lazy the way the reconciler
// does, by calling its `_init` on its `_payload`: once the module has loaded
// that returns the export synchronously. Until then it throws (a thenable while
// pending, the error if loading failed); that is answered "not a control",
// the pre-mark behaviour, and the reconciler meets the same throw itself when
// it renders the element.
function unwrapLazy(type: unknown): unknown {
  if (typeof type !== "object" || type === null || Reflect.get(type, "$$typeof") !== LAZY) return type;
  const init: unknown = Reflect.get(type, "_init");
  if (typeof init !== "function") return undefined;
  try {
    return Reflect.apply(init, undefined, [Reflect.get(type, "_payload")]);
  } catch {
    return undefined;
  }
}
