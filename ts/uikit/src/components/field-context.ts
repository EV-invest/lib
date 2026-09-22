import * as React from "react";

/**
 * The id a `<Field>` hands to the one control it labels. `React.useId` is
 * derived from the position in the tree, so the server render and the hydrating
 * client agree on it — a module counter would not, and the label's `for` would
 * point at nothing after hydration.
 */
export interface FieldControl {
  id: string;
  /** Records a control taking the id; returns the release. */
  claim: () => () => void;
}

export const FieldControlContext = React.createContext<FieldControl | null>(null);

const DEV = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

/** The `claim` of a `Field`: warns in development when a second control takes the id. */
export function useFieldClaims(): () => () => void {
  const claims = React.useRef(0);
  return React.useCallback(() => {
    claims.current += 1;
    if (DEV && claims.current === 2) {
      console.warn(
        "@evinvest/uikit: two controls took the same <Field> id. A Field labels one control; " +
          "give the others an `id` of their own.",
      );
    }
    return () => {
      claims.current -= 1;
    };
  }, []);
}

/** The caller's `id` when given, else the enclosing `<Field>`'s, else none. */
export function useFieldControlId(id: string | undefined): string | undefined {
  const field = React.useContext(FieldControlContext);
  const fromField = id === undefined ? field : null;
  React.useEffect(() => fromField?.claim(), [fromField]);
  return id ?? fromField?.id;
}
