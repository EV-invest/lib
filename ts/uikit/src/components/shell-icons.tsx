import * as React from "react";

// lucide glyphs the shell needs, inlined so the kit keeps its zero-icon-dep footprint.
function Glyph({ className, children }: { className?: string | undefined; children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function ChevronLeftIcon({ className }: { className?: string | undefined }) {
  return (
    <Glyph className={className}>
      <path d="m15 18-6-6 6-6" />
    </Glyph>
  );
}

export function TriangleAlertIcon({ className }: { className?: string | undefined }) {
  return (
    <Glyph className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Glyph>
  );
}

export function InfoIcon({ className }: { className?: string | undefined }) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Glyph>
  );
}

export function RefreshIcon({ className }: { className?: string | undefined }) {
  return (
    <Glyph className={className}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </Glyph>
  );
}

export function CloseIcon({ className }: { className?: string | undefined }) {
  return (
    <Glyph className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Glyph>
  );
}
