import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Minimal `asChild` mechanism — the dep-light replacement for
 * `@radix-ui/react-slot`. Renders by cloning its single child, merging the
 * Slot's own props onto it: `className` is fused with `cn`, event handlers are
 * chained (child's runs first, then ours), and `style` objects are shallow
 * merged. Refs are composed so both the caller's and the child's ref fire.
 *
 * There is no Rust counterpart: Dioxus composition is expressed with `children`
 * directly, so `asChild` is a TS-only ergonomic.
 */
export interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
}

export const Slot = React.forwardRef<HTMLElement, SlotProps>(function Slot(
  { children, ...slotProps },
  forwardedRef,
) {
  if (!React.isValidElement(children)) {
    return React.Children.count(children) > 1
      ? React.Children.only(null)
      : null;
  }

  const child = children as React.ReactElement<Record<string, unknown>>;
  const childProps = child.props;

  const merged: Record<string, unknown> = { ...slotProps, ...childProps };

  for (const key of Object.keys(slotProps)) {
    const slotValue = (slotProps as Record<string, unknown>)[key];
    const childValue = childProps[key];
    if (/^on[A-Z]/.test(key) && typeof slotValue === "function") {
      merged[key] =
        typeof childValue === "function"
          ? (...args: unknown[]) => {
              (childValue as (...a: unknown[]) => void)(...args);
              (slotValue as (...a: unknown[]) => void)(...args);
            }
          : slotValue;
    } else if (key === "style") {
      merged[key] = { ...(slotValue as object), ...(childValue as object) };
    } else if (key === "className") {
      merged[key] = cn(slotValue as string, childValue as string);
    }
  }

  merged["ref"] = composeRefs(forwardedRef, (child as { ref?: React.Ref<unknown> }).ref);

  return React.cloneElement(child, merged);
});

function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref != null) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}
