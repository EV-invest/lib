"use client";

import {
  cn,
  NativeSelect,
  NativeSelectOption,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type SelectTriggerSize,
} from "@evinvest/uikit";
import { useRef, useSyncExternalStore } from "react";
import { useFormSelectValue } from "./form-select-value";
import type { PartClassNames } from "./parts";

/**
 * A form's choice that works before any script and looks like the kit after
 * it. The server, and a browser without JavaScript, get the kit's
 * `NativeSelect` — a real `<select name>` the form posts as is. Once the page
 * has hydrated it becomes the kit's `Select`, drawn in the palette instead of
 * the platform's menu, with the value in an input of the same `name`. Both
 * are the same box (height, width, border, inset), so the swap moves nothing.
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
// The trigger's geometry matched to `NativeSelect`'s at each size: full width,
// the same text size (16 px on phones, which keeps iOS from zooming).
// The chevron at full strength, as the native select draws it: the kit's
// trigger dims its own arrow.
const TRIGGER = "w-full min-w-0 text-ink [&>svg]:opacity-100";
const TRIGGER_TEXT: Record<SelectTriggerSize, string> = { sm: "text-base md:text-sm", md: "text-base md:text-sm", lg: "" };

const subscribe = () => () => {};
/** `false` on the server and while hydrating, `true` from the render after. */
const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);

export function FormSelect(props: FormSelectProps) {
  return <FormSelectView {...props} scripted={useHydrated()} />;
}

/**
 * Both states on demand — for the widget gallery, which renders on the server
 * and would only ever see the native one. Not part of the package's surface.
 */
export function FormSelectView({ scripted, ...props }: FormSelectProps & { scripted: boolean }) {
  const { name, options, placeholder, required, disabled, size = "md", id, className, classNames } = props;
  const initial = props.defaultValue ?? (placeholder !== undefined ? "" : (options[0]?.value ?? ""));
  const native = useRef<HTMLSelectElement>(null);
  // The box, not the trigger: `SelectTrigger` keeps its own ref for placing the list.
  const box = useRef<HTMLSpanElement>(null);
  const state = useFormSelectValue({ initial, native, box, scripted, onValueChange: props.onValueChange });
  const hint = placeholder !== undefined ? { placeholder } : {};
  const aria = { "aria-describedby": props["aria-describedby"], "aria-invalid": props["aria-invalid"] || state.invalid || undefined };

  if (!scripted) {
    return (
      <NativeSelect
        ref={native}
        name={name}
        id={id}
        size={size}
        {...hint}
        required={required}
        disabled={disabled}
        defaultValue={initial}
        wrapperClassName={cn(BOX, className)}
        className={classNames?.trigger}
        {...aria}
      >
        {options.map(o => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }

  return (
    <span ref={box} data-slot="form-select" className={cn(BOX, className)}>
      <Select value={state.value} onValueChange={state.choose} open={state.open} onOpenChange={state.setOpen}>
        <SelectTrigger id={id} size={size} disabled={disabled} aria-required={required || undefined} className={cn(TRIGGER, TRIGGER_TEXT[size], classNames?.trigger)} {...aria}>
          <SelectValue {...hint} />
        </SelectTrigger>
        <SelectContent className={classNames?.content}>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value} className={cn(size === "lg" && "py-2.5 text-base", classNames?.item)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {required ? (
        // Validated, so not `type="hidden"` (which the browser never checks);
        // under the trigger, out of the tab order, the accessibility tree and
        // the browser's autofill.
        <input
          name={name}
          value={state.value}
          required
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          onChange={() => {}}
          onInvalid={state.onInvalid}
          className="pointer-events-none absolute inset-0 opacity-0"
        />
      ) : (
        // Nothing chosen posts nothing, as a native select on its disabled placeholder.
        state.value !== "" && <input type="hidden" name={name} value={state.value} disabled={disabled} />
      )}
    </span>
  );
}
