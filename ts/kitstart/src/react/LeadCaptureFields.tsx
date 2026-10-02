"use client";

import { Button, cn, Field, FieldDescription, FieldLabel, Input } from "@evinvest/uikit";
import { useId, useRef, useState } from "react";
import { isPlausiblePhone } from "../core/phone";
import type { PartClassNames } from "./parts";
import { PHONE_INPUT_PROPS } from "./QuoteFormShell";

export type FieldPart = "field" | "label" | "control" | "hint" | "chips" | "chip";

/** More than this and the row is a list to read, not a tap to save typing. */
const MAX_CHIPS = 6;

const optionalLabel = (label: string, optional: string | null) => (optional ? `${label} (${optional})` : label);

/** Digits only: a postcode, which the numeric keypad can type and edit. */
const POSTCODE = /^\d+$/;

export function LocalityField(props: {
  name: string;
  label: string;
  servedLabel: string;
  /** What the place knows of where it goes — a postcode or communes: one is filled in, a few are a tap each. */
  served: readonly string[];
  required: boolean;
  optional: string;
  hydrated: boolean;
  classNames?: PartClassNames<FieldPart> | undefined;
}) {
  const { name, label, servedLabel, served, required, optional, hydrated, classNames: c } = props;
  const input = useRef<HTMLInputElement>(null);
  const chips = hydrated && served.length > 1 && served.length <= MAX_CHIPS;
  // A commune's name filled in or a tap away must stay editable: iOS's numeric
  // keypad has no letters, so the keypad follows what the field is offered.
  // A list too long for chips offers nothing — the visitor types a postcode.
  const numeric = served.length > MAX_CHIPS || served.every(s => POSTCODE.test(s));
  return (
    <Field className={cn("flex flex-col gap-2", c?.field)}>
      <FieldLabel className={c?.label}>{optionalLabel(label, required ? null : optional)}</FieldLabel>
      <Input
        ref={input}
        name={name}
        size="lg"
        inputMode={numeric ? "numeric" : "text"}
        autoComplete="postal-code"
        enterKeyHint="next"
        required={required}
        defaultValue={served.length === 1 ? served[0] : undefined}
        data-lead-field="locality"
        className={c?.control}
      />
      {chips && (
        <div role="group" aria-label={servedLabel} className={cn("flex flex-wrap gap-2", c?.chips)}>
          {served.map(commune => (
            <Button
              key={commune}
              type="button"
              variant="outline"
              size="touch"
              className={cn("px-3", c?.chip)}
              onClick={() => {
                if (input.current) input.current.value = commune;
              }}
            >
              {commune}
            </Button>
          ))}
        </div>
      )}
    </Field>
  );
}

/**
 * The number, required and never masked. A value that does not read as a
 * phone gets a hint under it when the visitor leaves the field — a hint, not
 * a refusal: the server keeps what it cannot parse, as typed.
 */
export function PhoneField(props: {
  name: string;
  label: string;
  hint: string;
  onSoftError: () => void;
  classNames?: PartClassNames<FieldPart> | undefined;
}) {
  const { name, label, hint, onSoftError, classNames: c } = props;
  const hintId = useId();
  const [doubtful, setDoubtful] = useState(false);
  return (
    <Field className={cn("flex flex-col gap-2", c?.field)}>
      <FieldLabel className={c?.label}>{label}</FieldLabel>
      <Input
        name={name}
        size="lg"
        {...PHONE_INPUT_PROPS}
        enterKeyHint="send"
        required
        data-lead-field="phone"
        aria-invalid={doubtful || undefined}
        aria-describedby={doubtful ? hintId : undefined}
        onBlur={e => {
          const value = e.currentTarget.value;
          const bad = value.trim() !== "" && !isPlausiblePhone(value);
          if (bad && !doubtful) onSoftError();
          setDoubtful(bad);
        }}
        onInput={e => {
          if (doubtful && isPlausiblePhone(e.currentTarget.value)) setDoubtful(false);
        }}
        className={c?.control}
      />
      {doubtful && (
        <FieldDescription id={hintId} className={cn("text-accent-error", c?.hint)}>
          {hint}
        </FieldDescription>
      )}
    </Field>
  );
}

export function NameField(props: { name: string; label: string; required: boolean; optional: string; classNames?: PartClassNames<FieldPart> | undefined }) {
  const { name, label, required, optional, classNames: c } = props;
  return (
    <Field className={cn("flex flex-col gap-2", c?.field)}>
      <FieldLabel className={c?.label}>{optionalLabel(label, required ? null : optional)}</FieldLabel>
      <Input name={name} size="lg" autoComplete="name" enterKeyHint="next" required={required} data-lead-field="name" className={c?.control} />
    </Field>
  );
}
