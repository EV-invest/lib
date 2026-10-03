"use client";

import { Button, cn, Field, FieldDescription, FieldError, FieldLabel, Input } from "@evinvest/uikit";
import { useEffect, useId, useRef, useState } from "react";
import type { LeadCaptureText } from "../core/lead-capture-text";
import { CONSENT_FIELD } from "../core/lead";
import { phoneProblem } from "../core/phone";
import type { PartClassNames } from "./parts";
import { PHONE_INPUT_PROPS } from "./QuoteFormShell";
import { useValidity } from "./use-validity";

export type FieldPart = "field" | "label" | "control" | "hint" | "error" | "chips" | "chip";

/** More than this and the row is a list to read, not a tap to save typing. */
const MAX_CHIPS = 6;

const optionalLabel = (label: string, optional: string | null) => (optional ? `${label} (${optional})` : label);

/** Digits only: a postcode, which the numeric keypad can type and edit. */
const POSTCODE = /^\d+$/;

/**
 * What a field says under itself: the error that blocks (the server's, or the
 * browser's refusal in the page's words) as an alert, else a hint. Always in
 * the DOM: a live region announces only what changes inside it.
 */
function FieldMessage(props: { id: string; error: string | null; hint?: string | null | undefined; classNames: PartClassNames<FieldPart> | undefined }) {
  const { id, error, hint, classNames: c } = props;
  return (
    // Empty, it leaves the flex flow (an absolute child takes no gap, whatever
    // gap the brand gives the field) rather than vanish: a live region hidden
    // while empty is not one some screen readers listen to.
    <div aria-live="polite" className="empty:absolute">
      {error ? (
        <FieldError id={id} className={cn("text-accent-error", c?.error)}>
          {error}
        </FieldError>
      ) : hint ? (
        <FieldDescription id={id} className={cn("text-accent-error", c?.hint)}>
          {hint}
        </FieldDescription>
      ) : null}
    </div>
  );
}

const required = (text: string, on: boolean) => (el: HTMLInputElement) => (on && el.value.trim() === "" ? text : "");

export function LocalityField(props: {
  name: string;
  label: string;
  servedLabel: string;
  /** What the place knows of where it goes — a postcode or communes: one is filled in, a few are a tap each. */
  served: readonly string[];
  placeholder: string | undefined;
  required: boolean;
  optional: string;
  requiredText: string;
  /** The server's refusal of this field, in the page's words. */
  error: string | null;
  hydrated: boolean;
  classNames?: PartClassNames<FieldPart> | undefined;
}) {
  const { name, label, servedLabel, served, optional, hydrated, classNames: c } = props;
  const messageId = useId();
  const validity = useValidity(required(props.requiredText, props.required));
  const error = props.error ?? validity.shown;
  const chips = hydrated && served.length > 1 && served.length <= MAX_CHIPS;
  // A commune's name filled in or a tap away must stay editable: iOS's numeric
  // keypad has no letters, so the keypad follows what the field is offered.
  // A list too long for chips offers nothing — the visitor types a postcode.
  const numeric = served.length > MAX_CHIPS || served.every(s => POSTCODE.test(s));
  return (
    <Field className={cn("flex flex-col gap-2", c?.field)}>
      <FieldLabel className={c?.label}>{optionalLabel(label, props.required ? null : optional)}</FieldLabel>
      <Input
        ref={validity.ref}
        name={name}
        size="lg"
        inputMode={numeric ? "numeric" : "text"}
        autoComplete="postal-code"
        placeholder={props.placeholder}
        enterKeyHint="next"
        required={props.required}
        defaultValue={served.length === 1 ? served[0] : undefined}
        data-lead-field="locality"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? messageId : undefined}
        onInvalid={validity.onInvalid}
        onChange={validity.onChange}
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
                const el = validity.ref.current;
                if (!el) return;
                el.value = commune;
                validity.recheck(el);
              }}
            >
              {commune}
            </Button>
          ))}
        </div>
      )}
      <FieldMessage id={messageId} error={error} classNames={c} />
    </Field>
  );
}

export type PhoneText = Pick<LeadCaptureText, "phoneLabel" | "phoneHint" | "phoneInvalid" | "required" | "phonePlaceholder">;

/**
 * The number, required and never masked, on the rule the server holds it to
 * (`phoneProblem`): one it would refuse blocks the submit, in the page's
 * words. Leaving the field with such a number shows the hint already — a
 * hint, read out, not yet an error.
 */
export function PhoneField(props: {
  name: string;
  /** Named when the label is not the `Field`'s own (the callback's). */
  id?: string | undefined;
  text: PhoneText;
  /** The server's refusal of this field, in the page's words. */
  error: string | null;
  onSoftError: () => void;
  classNames?: PartClassNames<FieldPart> | undefined;
}) {
  const { name, text, onSoftError, classNames: c } = props;
  const messageId = useId();
  const [doubtful, setDoubtful] = useState(false);
  const validity = useValidity(el => {
    const problem = phoneProblem(el.value);
    return problem === "required" ? text.required : problem === "invalid" ? text.phoneInvalid : "";
  });
  const error = props.error ?? validity.shown;
  const marked = Boolean(error) || doubtful;
  // A hint drawn on the blur a press causes pushes whatever is below the
  // field down between press and release, and the tap lands on nothing (the
  // consent box, the submit). So a press on this form's submit draws no hint
  // — the submit's own check speaks instead — and a press anywhere else
  // draws it only once the press is over.
  const pressed = useRef<"submit" | "other" | null>(null);
  useEffect(() => {
    const press = (event: PointerEvent) => {
      const own = validity.ref.current;
      const target = event.target instanceof Element ? event.target : null;
      const submit = target?.closest("[type=submit]");
      pressed.current = target === own ? null : submit && own?.form?.contains(submit) ? "submit" : "other";
    };
    // A press that blurred nothing must not hold a later keyboard blur.
    const release = () => {
      pressed.current = null;
    };
    document.addEventListener("pointerdown", press, true);
    document.addEventListener("pointerup", release, true);
    document.addEventListener("pointercancel", release, true);
    return () => {
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("pointerup", release, true);
      document.removeEventListener("pointercancel", release, true);
    };
  }, [validity.ref]);
  const judge = (value: string) => {
    const bad = value.trim() !== "" && phoneProblem(value) !== null;
    if (bad && !doubtful) onSoftError();
    setDoubtful(bad);
  };
  return (
    <Field {...(props.id ? { controlId: props.id } : {})} className={cn("flex flex-col gap-2", c?.field)}>
      <FieldLabel className={c?.label}>{text.phoneLabel}</FieldLabel>
      <Input
        ref={validity.ref}
        name={name}
        size="lg"
        {...PHONE_INPUT_PROPS}
        enterKeyHint="send"
        placeholder={text.phonePlaceholder}
        required
        data-lead-field="phone"
        aria-invalid={marked || undefined}
        aria-describedby={marked ? messageId : undefined}
        onInvalid={validity.onInvalid}
        onBlur={e => {
          const value = e.currentTarget.value;
          const press = pressed.current;
          pressed.current = null;
          if (press === "submit") return;
          if (press === null) return judge(value);
          // After the release's click, which lands where the press began; a
          // cancelled press (a scroll) ends the wait too.
          const over = () => {
            window.removeEventListener("pointerup", over);
            window.removeEventListener("pointercancel", over);
            setTimeout(() => judge(value), 0);
          };
          window.addEventListener("pointerup", over);
          window.addEventListener("pointercancel", over);
        }}
        onChange={e => {
          validity.onChange(e);
          if (doubtful && phoneProblem(e.currentTarget.value) === null) setDoubtful(false);
        }}
        className={c?.control}
      />
      <FieldMessage id={messageId} error={error} hint={doubtful ? text.phoneHint : null} classNames={c} />
    </Field>
  );
}

export function NameField(props: {
  name: string;
  label: string;
  placeholder: string | undefined;
  required: boolean;
  optional: string;
  requiredText: string;
  error: string | null;
  classNames?: PartClassNames<FieldPart> | undefined;
}) {
  const { name, label, placeholder, optional, classNames: c } = props;
  const messageId = useId();
  const validity = useValidity(required(props.requiredText, props.required));
  const error = props.error ?? validity.shown;
  return (
    <Field className={cn("flex flex-col gap-2", c?.field)}>
      <FieldLabel className={c?.label}>{optionalLabel(label, props.required ? null : optional)}</FieldLabel>
      <Input
        ref={validity.ref}
        name={name}
        size="lg"
        autoComplete="name"
        enterKeyHint="next"
        placeholder={placeholder}
        required={props.required}
        data-lead-field="name"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? messageId : undefined}
        onInvalid={validity.onInvalid}
        onChange={validity.onChange}
        className={c?.control}
      />
      <FieldMessage id={messageId} error={error} classNames={c} />
    </Field>
  );
}

/**
 * The callback's consent: a native checkbox, so `required` holds without a
 * script (the kit's checkbox is a button), whose value is the sentence beside
 * it — the lead keeps what was agreed to, word for word.
 */
export function ConsentField(props: { sentence: string; requiredText: string; error: string | null; className: string | undefined; classNames: PartClassNames<FieldPart> | undefined }) {
  const messageId = useId();
  const validity = useValidity(el => (el.checked ? "" : props.requiredText));
  const error = props.error ?? validity.shown;
  return (
    <div className="flex flex-col gap-2">
      <label className={cn("flex min-h-11 items-start gap-3 text-sm text-ink", props.className)}>
        <input
          ref={validity.ref}
          type="checkbox"
          name={CONSENT_FIELD}
          value={props.sentence}
          required
          data-lead-field="consent"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? messageId : undefined}
          onInvalid={validity.onInvalid}
          onChange={validity.onChange}
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span>{props.sentence}</span>
      </label>
      <FieldMessage id={messageId} error={error} classNames={props.classNames} />
    </div>
  );
}

/**
 * A refusal no field shows under itself — a brand's extra, the whole form —
 * just above the submit. Only there when there is one: an alert is read out
 * as it is inserted, and an empty box would add the form's gap.
 */
export function FormMessage(props: { id: string; error: string | null; className: string | undefined }) {
  if (!props.error) return null;
  return (
    <FieldError id={props.id} tabIndex={-1} className={cn("text-accent-error outline-none", props.className)}>
      {props.error}
    </FieldError>
  );
}
