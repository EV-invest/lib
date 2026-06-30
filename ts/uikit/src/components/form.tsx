import * as React from "react";
import { cn } from "../lib/cn";
import { Label } from "./label";
import { Slot } from "../primitives/slot";
import { FORM_DESCRIPTION, FORM_ITEM, FORM_MESSAGE } from "../generated/form";

/**
 * Dep-light, presentational form primitives. We keep the ARIA id-wiring of
 * shadcn's form (label/control/description/message share an id so
 * `aria-describedby`/`id` line up) but drop `react-hook-form`'s state engine:
 * validation and field state are the consumer's job. `FormItem` mints an id via
 * `React.useId` and exposes it through `FormItemContext`.
 */
type FormItemContextValue = {
  id: string;
  formItemId: string;
  formDescriptionId: string;
  formMessageId: string;
};

const FormItemContext = React.createContext<FormItemContextValue | null>(null);

function useFormItem(): FormItemContextValue {
  const ctx = React.useContext(FormItemContext);
  if (!ctx) {
    throw new Error("Form parts must be used within <FormItem>");
  }
  return ctx;
}

export function Form({ ...props }: React.ComponentProps<"form">) {
  return <form data-slot="form" {...props} />;
}

export function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId();
  const value = React.useMemo<FormItemContextValue>(
    () => ({
      id,
      formItemId: `${id}-form-item`,
      formDescriptionId: `${id}-form-item-description`,
      formMessageId: `${id}-form-item-message`,
    }),
    [id],
  );

  return (
    <FormItemContext.Provider value={value}>
      <div data-slot="form-item" className={cn(FORM_ITEM, className)} {...props} />
    </FormItemContext.Provider>
  );
}

export function FormLabel({
  className,
  error,
  ...props
}: React.ComponentProps<typeof Label> & { error?: boolean }) {
  const { formItemId } = useFormItem();

  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  );
}

export function FormControl({
  error,
  ...props
}: React.ComponentProps<typeof Slot> & { error?: boolean }) {
  const { formItemId, formDescriptionId, formMessageId } = useFormItem();

  return (
    <Slot
      data-slot="form-control"
      id={formItemId}
      aria-describedby={
        !error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  );
}

export function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormItem();

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn(FORM_DESCRIPTION, className)}
      {...props}
    />
  );
}

export function FormMessage({ className, children, ...props }: React.ComponentProps<"p">) {
  const { formMessageId } = useFormItem();

  if (!children) {
    return null;
  }

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn(FORM_MESSAGE, className)}
      {...props}
    >
      {children}
    </p>
  );
}
