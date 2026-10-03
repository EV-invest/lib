"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Button } from "./button";
import { RefreshIcon, TriangleAlertIcon } from "./shell-icons";

export interface ResourceErrorLabels {
  /** The retry button. Default `"Try again"`. */
  retry?: string;
}

interface ResourceErrorBase extends Omit<React.ComponentProps<"div">, "title" | "children"> {
  /** What failed, already in the reader's words — the kit formats no errors. */
  message: React.ReactNode;
  labels?: ResourceErrorLabels;
}

// The two forms take different props and the union says so: an `alert` has no
// retry and an `inline` line has no heading, so asking for either is a type
// error rather than a prop that silently does nothing.
export type ResourceErrorProps = ResourceErrorBase &
  (
    | {
        /** One line under the page header — for dense screens where a block would push everything down. */
        variant?: "inline";
        title?: never;
        /** Re-run the read; boxes the line so the button and the message read as one thing. */
        onRetry?: () => void;
        /** The retry is in flight: the button is disabled and its icon spins. */
        retrying?: boolean;
      }
    | {
        /** The kit's `Alert` with a heading — for screens that address the reader. */
        variant: "alert";
        title?: React.ReactNode;
        onRetry?: never;
        retrying?: never;
      }
  );

/**
 * What a screen shows when a read it needed never arrived. Whether there is
 * anything to report stays with the caller — only it knows whether stale data is
 * still on screen, and a failed refresh over figures the reader can see belongs
 * beside them, not in place of them.
 */
export function ResourceError(props: ResourceErrorProps) {
  if (props.variant === "alert") {
    const { message, title, labels: _labels, variant: _variant, className, ...rest } = props;
    return (
      <div data-slot="resource-error" data-variant="alert" className={className} {...rest}>
        <Alert variant="destructive">
          <TriangleAlertIcon className="size-4" />
          {title !== undefined && <AlertTitle>{title}</AlertTitle>}
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </div>
    );
  }
  const { message, onRetry, retrying = false, labels = {}, variant: _variant, title: _title, className, ...rest } = props;
  const line = (
    <p className="flex min-w-0 items-center gap-2 text-sm text-accent-error">
      {/* Holds its size: beside the button it is the first thing squeezed, and a
          half-width triangle reads as a rendering fault. */}
      <TriangleAlertIcon className="size-4 shrink-0" /> {message}
    </p>
  );
  return (
    <div
      data-slot="resource-error"
      data-variant="inline"
      role="alert"
      className={cn(
        onRetry &&
          "flex flex-wrap items-center gap-3 rounded-lg border border-accent-error/40 bg-accent-error/10 px-3 py-2.5",
        className,
      )}
      {...rest}
    >
      {line}
      {onRetry && (
        <Button type="button" variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
          <RefreshIcon className={cn("size-4", retrying && "motion-safe:animate-spin")} />
          {labels.retry ?? "Try again"}
        </Button>
      )}
    </div>
  );
}
