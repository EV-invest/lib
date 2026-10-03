"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

/**
 * A control's validity in the page's words. `message(el)` is what is wrong
 * now, `""` when nothing is; it is the control's custom validity from the
 * first render on, so the browser blocks the submit and its bubble speaks the
 * page's language, not the browser's. `shown` is the message once the browser
 * refused the control (`invalid`), until the visitor fixes it — for the
 * field to show under itself and mark `aria-invalid`.
 */
export function useValidity<E extends HTMLInputElement>(message: (el: E) => string) {
  const ref = useRef<E>(null);
  const [shown, setShown] = useState<string | null>(null);
  const latest = useRef(message);
  latest.current = message;
  // Every render: the words arrive as props and may change with the locale.
  useEffect(() => {
    const el = ref.current;
    if (el) el.setCustomValidity(latest.current(el));
  });
  const recheck = (el: E) => {
    const now = latest.current(el);
    el.setCustomValidity(now);
    if (now === "") setShown(null);
    else setShown(was => (was === null ? null : now));
  };
  return {
    ref,
    shown,
    onInvalid: (event: FormEvent<E>) => setShown(latest.current(event.currentTarget) || event.currentTarget.validationMessage),
    onChange: (event: ChangeEvent<E>) => recheck(event.currentTarget),
    /** After a value set by script, which fires no input event. */
    recheck,
  };
}
