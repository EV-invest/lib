import * as React from "react";
import { cn } from "../lib/cn";
import {
  ALERT_BASE,
  ALERT_DESCRIPTION,
  ALERT_TITLE,
  alertVariants,
  type AlertVariant,
} from "../generated/alert";

export type { AlertVariant };

export interface AlertProps extends React.ComponentProps<"div"> {
  variant?: AlertVariant;
}

export function Alert({ className, variant = "default", ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(ALERT_BASE, alertVariants[variant], className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(ALERT_TITLE, className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(ALERT_DESCRIPTION, className)}
      {...props}
    />
  );
}
