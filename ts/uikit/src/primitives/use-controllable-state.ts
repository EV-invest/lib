import * as React from "react";

/**
 * Controlled/uncontrolled state, the dep-light equivalent of Radix's
 * `useControllableState`. When `value` is provided the component is controlled
 * (the hook returns it and routes writes through `onChange`); otherwise it owns
 * an internal `useState` seeded from `defaultValue`.
 *
 * The Rust mirror is `use_controllable_signal` in `ev::uikit`.
 */
export function useControllableState<T>(opts: {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}): [T, (next: T) => void] {
  const { value, defaultValue, onChange } = opts;
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = React.useState<T>(defaultValue);

  const current = isControlled ? value : uncontrolled;

  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });

  const setValue = React.useCallback(
    (next: T) => {
      if (!isControlled) setUncontrolled(next);
      onChangeRef.current?.(next);
    },
    [isControlled],
  );

  return [current, setValue];
}
