import * as React from "react";

/**
 * Combines several refs into one callback ref so a node can satisfy multiple
 * consumers at once (e.g. an overlay that is both the floating element and the
 * dismissable layer). Used throughout the overlay components.
 */
export function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref != null) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}
