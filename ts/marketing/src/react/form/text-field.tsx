import { useId, type ChangeEvent, type HTMLAttributes, type ReactNode } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Textarea,
} from "@evinvest/uikit";

export interface TextFieldProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  /** Already translated. `useValidatedForm().field()` passes it resolved. */
  error?: string | undefined;
  /** Helper line under the control; hidden while an error shows. */
  description?: ReactNode;
  /** Renders a textarea with this many rows instead of an input. */
  rows?: number;
  type?: "text" | "email" | "tel" | "url" | "search" | "password";
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  disabled?: boolean;
  className?: string;
}

/**
 * One labelled text control on the uikit `Field` / `Input` / `Textarea`, so a
 * marketing form carries no field wrapper of its own and inherits the kit's
 * tokens, focus ring and invalid styling.
 *
 * The error is announced for the control, not just painted: `aria-invalid`
 * plus `aria-describedby` pointing at the `role="alert"` message, so a screen
 * reader hears *which* field failed when focus lands on it.
 */
export function TextField({
  label,
  value,
  onChange,
  error,
  description,
  rows,
  type = "text",
  className,
  ...native
}: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const describedBy = error ? errorId : description ? descriptionId : undefined;

  const shared = {
    ...native,
    id,
    value,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };

  return (
    <Field className={className} data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {rows ? <Textarea rows={rows} {...shared} /> : <Input type={type} {...shared} />}
      {error ? (
        <FieldError id={errorId}>{error}</FieldError>
      ) : description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
    </Field>
  );
}
