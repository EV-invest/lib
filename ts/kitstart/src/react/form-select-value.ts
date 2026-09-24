"use client";

import { useEffect, useLayoutEffect, useRef, useState, type InvalidEvent, type RefObject } from "react";

/**
 * The value `FormSelect` posts, across the swap from the native select and
 * through the form's own life: a reset, and a required check that points at
 * the kit's trigger instead of an input nobody sees.
 */
export function useFormSelectValue(opts: {
  initial: string;
  native: RefObject<HTMLSelectElement | null>;
  box: RefObject<HTMLElement | null>;
  scripted: boolean;
  onValueChange: ((value: string) => void) | undefined;
}) {
  const { initial, native, box, scripted, onValueChange } = opts;
  const [value, setValue] = useState(initial);
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const initialRef = useRef(initial);
  initialRef.current = initial;

  // A choice made in the native select before the script arrived survives the
  // swap: read in the hydration commit, before the scripted render. Once —
  // later renders never hold the native select.
  useLayoutEffect(() => {
    if (native.current) setValue(native.current.value);
  }, [native]);

  // A form reset puts a native select back on its default; so does this.
  // Interactive validation — the browser's own, on a submit — is told apart
  // from a script's `checkValidity()` by the submit that starts it.
  const submitting = useRef(false);
  useEffect(() => {
    const form = box.current?.closest("form");
    if (!scripted || !form) return;
    const reset = () => setValue(initialRef.current);
    const submit = (e: Event) => {
      const target = e.target as HTMLButtonElement | HTMLInputElement | null;
      if (target?.form !== form || target.type !== "submit") return;
      submitting.current = true;
      // The invalid events of this submit fire before the task ends.
      setTimeout(() => (submitting.current = false), 0);
    };
    form.addEventListener("reset", reset);
    form.addEventListener("click", submit, true);
    return () => {
      form.removeEventListener("reset", reset);
      form.removeEventListener("click", submit, true);
    };
  }, [box, scripted]);

  const choose = (next: string) => {
    setValue(next);
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
