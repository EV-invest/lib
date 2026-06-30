import * as React from "react";
import { cn } from "../lib/cn";
import { Label } from "./label";
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

export function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & { orientation?: FieldOrientation }) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(FIELD_BASE, fieldOrientation[orientation], className)}
      {...props}
    />
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

export function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(FIELD_LABEL, className)}
      {...props}
    />
  );
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
