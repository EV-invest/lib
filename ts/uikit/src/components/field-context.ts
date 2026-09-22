import * as React from "react";

/**
 * The id a `<Field>` mints for the one control it labels. `React.useId` is
 * derived from the position in the tree, so the server render and the hydrating
 * client agree on it — a module counter would not, and the label's `for` would
 * point at nothing after hydration.
 */
export const FieldControlIdContext = React.createContext<string | undefined>(undefined);

/** The caller's `id` when given, else the enclosing `<Field>`'s, else none. */
export function useFieldControlId(id: string | undefined): string | undefined {
  const fieldId = React.useContext(FieldControlIdContext);
  return id ?? fieldId;
}
