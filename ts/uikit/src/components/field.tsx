"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { Label } from "./label";
import { walkElements } from "../primitives/walk-elements";
import { Checkbox } from "./checkbox";
import { FieldControlContext, useFieldClaims } from "./field-context";
import { Input } from "./input";
import { NativeSelect } from "./native-select";
import { SelectTrigger } from "./select";
import { Switch } from "./switch";
import { Textarea } from "./textarea";
import {
  FIELD_BASE,
  FIELD_SET,
  FIELD_LEGEND,
  FIELD_GROUP,
  FIELD_CONTENT,
  FIELD_LABEL,
  FIELD_TITLE,
  FIELD_DESCRIPTION,
  FIELD_SEPARATOR,
  FIELD_SEPARATOR_LINE,
  FIELD_SEPARATOR_CONTENT,
  FIELD_ERROR,
  fieldOrientation,
  type FieldOrientation,
} from "../generated/field";

export type { FieldOrientation };

export function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(FIELD_SET, className)}
      {...props}
    />
  );
}

export function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(FIELD_LEGEND, className)}
      {...props}
    />
  );
}

export function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(FIELD_GROUP, className)}
      {...props}
    />
  );
}

/**
 * A labelled control. `Field` mints one id and hands it to both ends: its
 * `FieldLabel` takes it as `for`, and the kit's `Input`, `Textarea`,
 * `NativeSelect`, `SelectTrigger`, `Checkbox` and `Switch` take it as `id` —
 * each only when the caller passed none. `controlId` names the id instead of
 * minting one. One control per `Field`: a field that holds two has to name
 * their ids by hand, or both would claim the one id (a development warning
 * says so).
 */
export function Field({
  className,
  orientation = "vertical",
  controlId,
  ...props
}: React.ComponentProps<"div"> & { orientation?: FieldOrientation; controlId?: string }) {
  const minted = React.useId();
  const claim = useFieldClaims();
  const id = controlId ?? minted;
  const control = React.useMemo(() => ({ id, claim }), [id, claim]);
  return (
    <FieldControlContext.Provider value={control}>
      <div
        role="group"
        data-slot="field"
        data-orientation={orientation}
        className={cn(FIELD_BASE, fieldOrientation[orientation], className)}
        {...props}
      />
    </FieldControlContext.Provider>
  );
}

export function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(FIELD_CONTENT, className)}
      {...props}
    />
  );
}

export interface FieldLabelProps extends Omit<React.ComponentProps<typeof Label>, "htmlFor"> {
  /** `null` opts out of the `Field`'s id: the label then has no `for` at all. */
  htmlFor?: string | null;
}

/**
 * Takes its `Field`'s id as `for` unless it wraps a control itself — a label
 * around an `<input>` already labels it, and a `for` pointing elsewhere would
 * steal the click. A control inside a component of yours is invisible to that
 * check; pass `htmlFor={null}` there.
 */
export function FieldLabel({ className, htmlFor, children, ...props }: FieldLabelProps) {
  const field = React.useContext(FieldControlContext);
  const target = htmlFor === null ? undefined : (htmlFor ?? (wrapsControl(children) ? undefined : field?.id));
  return (
    <Label
      data-slot="field-label"
      htmlFor={target}
      className={cn(FIELD_LABEL, className)}
      {...props}
    >
      {children}
    </Label>
  );
}

// The labelable elements (HTML's list, less `output`/`meter`/`progress`, which a
// field label never wraps) and the kit's controls that render one — plus a
// nested `Field`, the choice-card shape, whose control is labelled by its own.
const LABELABLE_TAGS = new Set(["input", "select", "textarea", "button"]);
const LABELABLE_KIT: ReadonlySet<unknown> = new Set([Input, Textarea, NativeSelect, Checkbox, Switch, SelectTrigger, Field]);

function wrapsControl(children: React.ReactNode): boolean {
  let found = false;
  walkElements(children, (element) => {
    if (found) return false;
    const { type } = element;
    const props = element.props as { type?: unknown };
    if (typeof type === "string" ? LABELABLE_TAGS.has(type) && props.type !== "hidden" : LABELABLE_KIT.has(type)) {
      found = true;
    }
    return !found;
  });
  return found;
}

export function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(FIELD_TITLE, className)}
      {...props}
    />
  );
}

export function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(FIELD_DESCRIPTION, className)}
      {...props}
    />
  );
}

export function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & { children?: React.ReactNode }) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(FIELD_SEPARATOR, className)}
      {...props}
    >
      <div role="separator" className={FIELD_SEPARATOR_LINE} />
      {children && (
        <span
          className={FIELD_SEPARATOR_CONTENT}
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  );
}

export function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const content = React.useMemo(() => {
    if (children) {
      return children;
    }

    if (!errors) {
      return null;
    }

    if (errors?.length === 1 && errors[0]?.message) {
      return errors[0].message;
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {errors.map(
          (error, index) => error?.message && <li key={index}>{error.message}</li>,
        )}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn(FIELD_ERROR, className)}
      {...props}
    >
      {content}
    </div>
  );
}
