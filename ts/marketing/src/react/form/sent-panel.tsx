import type { ReactNode } from "react";
import { cn } from "@evinvest/uikit";

export interface SentPanelProps {
  title: ReactNode;
  children?: ReactNode;
  /** Replaces the default check mark (e.g. a brand glyph). */
  icon?: ReactNode;
  className?: string;
}

// Inline SVG rather than an icon library: one glyph does not justify a peer.
function CheckMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Post-submit confirmation that replaces a form once it is sent.
 * `role="status"` makes the swap audible: without it a screen-reader user
 * presses submit and hears nothing while the form silently disappears.
 */
export function SentPanel({ title, children, icon, className }: SentPanelProps) {
  return (
    <div
      role="status"
      data-slot="sent-panel"
      className={cn(
        "flex flex-col items-center rounded-xl border border-primary-ink/30 bg-card p-10 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary-ink/15 text-primary-ink">
        {icon ?? <CheckMark />}
      </div>
      <h3 className="text-2xl font-semibold text-ink">{title}</h3>
      {children ? <p className="mt-2 max-w-xs text-sm text-ink-mid">{children}</p> : null}
    </div>
  );
}
