"use client";

import { cn, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectTriggerSize } from "@evinvest/uikit";
import type { InvalidEvent, RefObject } from "react";
import type { FormSelectProps } from "./FormSelect";

/** What the scripted state is handed by `FormSelect`, which keeps the value across the swap. */
export interface FormSelectKitProps {
  field: FormSelectProps;
  box: RefObject<HTMLSpanElement | null>;
  value: string;
  choose: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  onInvalid: (e: InvalidEvent<HTMLInputElement>) => void;
  aria: { "aria-describedby": string | undefined; "aria-invalid": true | undefined };
}

const BOX = "relative inline-flex w-full";
// The trigger's geometry matched to `NativeSelect`'s at each size: full width,
// the same text size (16 px on phones, which keeps iOS from zooming).
// The chevron at full strength, as the native select draws it: the kit's
// trigger dims its own arrow.
const TRIGGER = "w-full min-w-0 text-ink [&>svg]:opacity-100";
const TRIGGER_TEXT: Record<SelectTriggerSize, string> = { sm: "text-base md:text-sm", md: "text-base md:text-sm", lg: "" };

/**
 * `FormSelect` once scripted: the kit's `Select`, the list drawn in the
 * palette, with the value in an input of the same `name`. A chunk of its own
 * — the list's placing, dismissal and keys weigh more than the rest of the
 * field — fetched once the page is idle, or as soon as the visitor reaches
 * for the field.
 */
export function FormSelectKit({ field, box, value, choose, open, setOpen, onInvalid, aria }: FormSelectKitProps) {
  const { name, options, placeholder, required, disabled, size = "md", id, className, classNames } = field;
  const hint = placeholder !== undefined ? { placeholder } : {};
  return (
    <span ref={box} data-slot="form-select" className={cn(BOX, className)}>
      <Select value={value} onValueChange={choose} open={open} onOpenChange={setOpen}>
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
          value={value}
          required
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          onChange={() => {}}
          onInvalid={onInvalid}
          className="pointer-events-none absolute inset-0 opacity-0"
        />
      ) : (
        // Nothing chosen posts nothing, as a native select on its disabled placeholder.
        value !== "" && <input type="hidden" name={name} value={value} disabled={disabled} />
      )}
    </span>
  );
}
