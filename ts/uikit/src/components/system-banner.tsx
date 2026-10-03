"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { CloseIcon, InfoIcon, TriangleAlertIcon } from "./shell-icons";

export type SystemBannerTone = "warn" | "info";

export interface SystemBannerLabels {
  /** The close button. Default `"Dismiss"`. */
  dismiss?: string;
}

export interface SystemBannerProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** `warn` — a platform state (maintenance, read-only); `info` — an announcement. */
  tone?: SystemBannerTone;
  /** Bold lead before the message. */
  title?: React.ReactNode;
  /** Replaces the tone's glyph; `null` drops it. */
  icon?: React.ReactNode;
  /** Shows a close button; remembering the dismissal is the caller's. */
  onDismiss?: () => void;
  labels?: SystemBannerLabels;
}

const TONE: Record<SystemBannerTone, string> = {
  warn: "border-accent-warn/40 bg-accent-warn/10 text-accent-warn",
  info: "border-border bg-card text-ink",
};

/**
 * A slim full-width strip above the page — presentation only: where its state
 * comes from, and whether a dismissal sticks, are the caller's. Put it in
 * `AppShell`'s `banner` slot; several stack with a gap.
 */
export function SystemBanner({
  tone = "info",
  title,
  icon,
  onDismiss,
  labels = {},
  className,
  children,
  ...props
}: SystemBannerProps) {
  const glyph =
    icon !== undefined ? icon : tone === "warn" ? <TriangleAlertIcon className="size-4" /> : <InfoIcon className="size-4" />;
  return (
    <div
      data-slot="system-banner"
      data-tone={tone}
      role="status"
      className={cn("flex items-start gap-2.5 rounded-lg border px-4 py-2.5 text-sm", TONE[tone], className)}
      {...props}
    >
      {glyph !== null && <span className="mt-0.5 flex shrink-0">{glyph}</span>}
      <div className="min-w-0 flex-1">
        {title !== undefined && <span className="font-semibold">{title}</span>}
        {title !== undefined && children !== undefined && " — "}
        {children !== undefined && (
          <span className={cn(title !== undefined && tone === "info" && "text-ink-soft")}>{children}</span>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label={labels.dismiss ?? "Dismiss"}
          onClick={onDismiss}
          className="-mr-1 shrink-0 rounded-md p-0.5 opacity-70 outline-none transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CloseIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
