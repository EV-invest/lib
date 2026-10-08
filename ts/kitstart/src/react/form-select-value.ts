"use client";

import { useEffect, useLayoutEffect, useRef, useState, type InvalidEvent, type RefObject } from "react";

const DEV = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

/**
 * The value `FormSelect` posts, across the swap from the native select and
 * through the form's own life: a reset, and a required check that points at
 * the kit's trigger instead of an input nobody sees.
 *
 * `controlled` (a `value` prop) follows React's input idiom: the prop is the
 * value, a choice reaches the parent only through `onValueChange`, and a reset
 * leaves it where the parent holds it. The own state still follows the prop,
 * so a switch back to uncontrolled keeps the last value, as an `<input>` does.
 */
export function useFormSelectValue(opts: {
  initial: string;
  controlled: string | undefined;
  native: RefObject<HTMLSelectElement | null>;
  box: RefObject<HTMLElement | null>;
  /** The page's script runs: the native select, if still drawn, is the field. */
  live: boolean;
  /** The kit's `Select` is drawn. */
  scripted: boolean;
  onValueChange: ((value: string) => void) | undefined;
}) {
  const { initial, controlled, native, box, live, scripted, onValueChange } = opts;
  const [own, setOwn] = useState(controlled ?? initial);
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const isControlled = controlled !== undefined;
  if (isControlled && own !== controlled) setOwn(controlled);
  const value = isControlled ? controlled : own;
  useModeWarning(isControlled);

  // The effects below run once or on a form event: they read the latest props here.
  const latest = useRef({ initial, isControlled, value, onValueChange });
  latest.current = { initial, isControlled, value, onValueChange };

  // A choice made in the native select before the script arrived survives the
  // swap: read in the hydration commit. Once — from then on the native
  // select, while it stays, reports its choices itself. Under a `value` it is the
  // parent's to take, so it is reported instead of kept — and only a real
  // pick: a `value` no option carries leaves the browser on its own default,
  // which is no choice of the visitor's.
  useLayoutEffect(() => {
    const select = native.current;
    if (!select) return;
    const picked = select.value;
    const { isControlled: held, value: shown, onValueChange: report } = latest.current;
    if (!held) setOwn(picked);
    else if (picked !== shown && picked !== untouched(select)) report?.(picked);
  }, [native]);

  // A form reset puts a native select back on its default; so does this.
  // Interactive validation — the browser's own, on a submit — is told apart
  // from a script's `checkValidity()` by the submit that starts it.
  const submitting = useRef(false);
  useEffect(() => {
    const form = (scripted ? box.current : native.current)?.closest("form");
    if (!live || !form) return;
    const reset = () => {
      if (!latest.current.isControlled) setOwn(latest.current.initial);
    };
    // On the document, not the form: a submit button may sit outside it
    // (`form="…"`), and the click may land on an icon inside the button.
    const submit = (e: Event) => {
      const control = (e.target as Element | null)?.closest?.("button, input");
      if (!(control instanceof HTMLButtonElement || control instanceof HTMLInputElement)) return;
      if (control.form !== form || control.type !== "submit") return;
      submitting.current = true;
      // The invalid events of this submit fire before the task ends.
      setTimeout(() => (submitting.current = false), 0);
    };
    form.addEventListener("reset", reset);
    document.addEventListener("click", submit, true);
    return () => {
      form.removeEventListener("reset", reset);
      document.removeEventListener("click", submit, true);
    };
  }, [box, native, live, scripted]);

  const choose = (next: string) => {
    if (!isControlled) setOwn(next);
    setInvalid(false);
    onValueChange?.(next);
  };

  // The browser's bubble would point at an input nobody sees: the trigger
  // takes the error state instead. On a submit, the form's first invalid
  // field also takes focus with its list open, where the bubble would have
  // been; a script's quiet `checkValidity()` moves nothing.
  const onInvalid = (e: InvalidEvent<HTMLInputElement>) => {
    e.preventDefault();
    setInvalid(true);
    if (!submitting.current) return;
    // `validity`, not `:invalid`: jsdom answers that selector by firing `invalid` again.
    const first = Array.from(e.currentTarget.form?.elements ?? []).find(el => "validity" in el && !(el as HTMLInputElement).validity.valid);
    if (first === e.currentTarget) {
      box.current?.querySelector("button")?.focus();
      setOpen(true);
    }
  };

  return { value, choose, invalid, open, setOpen, onInvalid };
}

/**
 * What a single select shows before anyone touches it: the option marked
 * `selected` in the markup, else the first enabled one (HTML's selectedness
 * setting). A pick of that same option is indistinguishable, and harmless.
 */
function untouched(select: HTMLSelectElement): string | undefined {
  const options = Array.from(select.options);
  return (options.find(o => o.defaultSelected) ?? options.find(o => !o.disabled))?.value;
}

/** React's warning for an `<input>` that changes mode: once, and nothing else changes. */
function useModeWarning(isControlled: boolean) {
  const first = useRef(isControlled);
  const warned = useRef(false);
  if (!DEV || warned.current || first.current === isControlled) return;
  warned.current = true;
  console.error(
    `@evinvest/kitstart: a FormSelect is changing from ${first.current ? "controlled to uncontrolled" : "uncontrolled to controlled"}. ` +
      "Keep one of `value` and `defaultValue` for its lifetime; `value={undefined}` makes it uncontrolled.",
  );
}
