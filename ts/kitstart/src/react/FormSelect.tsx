"use client";

import { cn, NativeSelect, NativeSelectOption, type SelectTriggerSize } from "@evinvest/uikit";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type PointerEvent } from "react";
import { useFormSelectValue } from "./form-select-value";
import { lazyPart } from "./lazy-part";
import type { PartClassNames } from "./parts";

/**
 * A form's choice that works before any script and looks like the kit after
 * it. The server, and a browser without JavaScript, get the kit's
 * `NativeSelect` — a real `<select name>` the form posts as is. Once the page
 * has hydrated and is idle, or as soon as the visitor reaches for the field,
 * it becomes the kit's `Select`, drawn in the palette instead of the
 * platform's menu, with the value in an input of the same `name`; until then
 * the native select is live, its choices reported. Both are the same box
 * (height, width, border, inset), so the swap moves nothing.
 *
 * Inside a `Field`, its label names whichever control is rendered: the
 * `Field`'s id goes to the `<select>` first and to the trigger after.
 */
export interface FormSelectOption {
  value: string;
  label: string;
}

/** `trigger`: the control in both states; `content` and `item`: the scripted list. */
export type FormSelectPart = "trigger" | "content" | "item";

// Optional props take `undefined` as the DOM's own props do, so a call site
// passes `LEAD.subjects[0]` or a maybe-id through as it would to a `<select>`.
export interface FormSelectProps {
  name: string;
  options: readonly FormSelectOption[];
  /** Without it: empty under a `placeholder`, else the first option — a native select's own rule. */
  defaultValue?: string | undefined;
  /**
   * Controlled: the value shown and posted, kept until the parent changes it
   * from `onValueChange` (a form reset leaves it too). `undefined` is
   * uncontrolled, as on an `<input>`; `""` is the placeholder.
   */
  value?: string | undefined;
  /** An empty, unpickable choice shown until one is made. */
  placeholder?: string | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  size?: SelectTriggerSize | undefined;
  id?: string | undefined;
  /** The box both states share — what a layout sizes. */
  className?: string | undefined;
  classNames?: PartClassNames<FormSelectPart> | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: boolean | undefined;
}

const BOX = "relative inline-flex w-full";

/** The scripted state, in a chunk of its own (`FormSelectKit`). */
const KIT = lazyPart(() => import("./FormSelectKit").then(m => m.FormSelectKit));

const subscribe = () => () => {};
/** `false` on the server and while hydrating, `true` from the render after. */
const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);

export function FormSelect(props: FormSelectProps) {
  const hydrated = useHydrated();
  const kit = useSyncExternalStore(KIT.subscribe, KIT.isLoaded, () => false);
  return <FormSelectField {...props} hydrated={hydrated} kit={hydrated && kit} />;
}

/**
 * Both states on demand — for the widget gallery, which renders on the server
 * and would only ever see the native one. Not part of the package's surface.
 */
export function FormSelectView({ scripted, ...props }: FormSelectProps & { scripted: boolean }) {
  return <FormSelectField {...props} hydrated={scripted} kit={scripted} />;
}

/** Asks for the scripted state when the page has nothing better to do. */
function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(run, { timeout: 2000 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(run, 200);
  return () => window.clearTimeout(handle);
}

/**
 * The native select until the scripted one is here. `hydrated`: the page's
 * script runs — the native select reports its choices and asks for the
 * scripted state on idle, or sooner on the visitor's reach (a mouse over it,
 * the focus). `kit`: the scripted state is loaded. A press before that opens
 * the platform's list at once, as before the script: never a wait on a chunk.
 */
function FormSelectField({ hydrated, kit, ...props }: FormSelectProps & { hydrated: boolean; kit: boolean }) {
  const { name, options, placeholder, required, disabled, size = "md", id, className, classNames } = props;
  const initial = props.defaultValue ?? (placeholder !== undefined ? "" : (options[0]?.value ?? ""));
  const native = useRef<HTMLSelectElement>(null);
  // The box, not the trigger: `SelectTrigger` keeps its own ref for placing the list.
  const box = useRef<HTMLSpanElement>(null);
  // The native select has the focus — its own list may be open (a phone's
  // picker): it stays until the focus leaves, rather than vanish under the finger.
  const [focused, setFocused] = useState(false);
  const scripted = kit && !focused;
  const state = useFormSelectValue({ initial, controlled: props.value, native, box, live: hydrated, scripted, onValueChange: props.onValueChange });
  const hint = placeholder !== undefined ? { placeholder } : {};
  const aria = { "aria-describedby": props["aria-describedby"], "aria-invalid": props["aria-invalid"] || state.invalid || undefined };

  useEffect(() => (hydrated && !kit ? whenIdle(KIT.preload) : undefined), [hydrated, kit]);
  // The native select is uncontrolled (see below): a value moved by the
  // parent, or put back by a reset, is written into it here.
  const written = useRef(state.value);
  useLayoutEffect(() => {
    if (written.current === state.value) return;
    written.current = state.value;
    if (native.current && native.current.value !== state.value) native.current.value = state.value;
  }, [state.value]);

  if (scripted) return <KIT.Part field={props} box={box} value={state.value} choose={state.choose} open={state.open} setOpen={state.setOpen} onInvalid={state.onInvalid} aria={aria} />;

  const live = hydrated
    ? {
        onChange: (e: ChangeEvent<HTMLSelectElement>) => {
          const picked = e.currentTarget.value;
          state.choose(picked);
          // Under a `value` the parent moves it, as on a controlled input.
          if (props.value !== undefined) e.currentTarget.value = props.value;
        },
        onPointerEnter: (e: PointerEvent<HTMLSelectElement>) => {
          if (e.pointerType === "mouse") KIT.preload();
        },
        onFocus: () => {
          setFocused(true);
          KIT.preload();
        },
        onBlur: () => setFocused(false),
      }
    : {};
  return (
    <NativeSelect
      ref={native}
      name={name}
      id={id}
      size={size}
      {...hint}
      required={required}
      disabled={disabled}
      // Uncontrolled even under `value`: before the script nothing could
      // follow a change, and a pick made then must survive into the swap.
      defaultValue={state.value}
      wrapperClassName={cn(BOX, className)}
      className={classNames?.trigger}
      {...aria}
      {...live}
    >
      {options.map(o => (
        <NativeSelectOption key={o.value} value={o.value}>
          {o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
