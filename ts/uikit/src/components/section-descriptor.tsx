import * as React from "react";
import { cn } from "../lib/cn";
import { FIELD_TITLE, FIELD_DESCRIPTION } from "../generated/field";

/**
 * `SectionDescriptor` — a static, always-visible block that explains a whole
 * feature (withdrawals, fund shares, an operator action). It reads as neutral body
 * copy, NOT a coloured alert: the title reuses `FIELD_TITLE`, the body reuses
 * `FIELD_DESCRIPTION`, inside a subtle bordered container. Content-agnostic — the
 * strings are injected by the caller.
 *
 * With `collapsible`, it renders as a native `<details>`/`<summary>` disclosure,
 * which carries keyboard support and find-in-page auto-expand for free.
 */
const SECTION_DESCRIPTOR =
  "flex flex-col gap-2 rounded-lg border bg-accent p-4 text-left";

// lucide `info`, inlined per the kit's no-lucide-dep icon convention.
function InfoGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-4 shrink-0", className)}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export interface SectionDescriptorProps extends Omit<
  React.ComponentProps<"section">,
  "title"
> {
  title: React.ReactNode;
  /** Show the leading ⓘ mark. Defaults to true. */
  icon?: boolean;
  /** Render as a collapsible `<details>` disclosure. */
  collapsible?: boolean;
  /** Initial open state when `collapsible`. */
  defaultOpen?: boolean;
}

export function SectionDescriptor({
  title,
  icon = true,
  collapsible = false,
  defaultOpen = false,
  className,
  children,
  ...props
}: SectionDescriptorProps) {
  const titleContent = (
    <>
      {icon && <InfoGlyph className="text-main-accent-t1" />}
      <span>{title}</span>
    </>
  );

  if (collapsible) {
    return (
      <details
        data-slot="section-descriptor"
        data-collapsible=""
        open={defaultOpen}
        className={cn(SECTION_DESCRIPTOR, className)}
        {...(props as Record<string, unknown>)}
      >
        <summary
          data-slot="section-descriptor-title"
          className={cn(
            FIELD_TITLE,
            "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
          )}
        >
          {titleContent}
        </summary>
        <p
          data-slot="section-descriptor-body"
          className={cn(FIELD_DESCRIPTION, "mt-2")}
        >
          {children}
        </p>
      </details>
    );
  }

  return (
    <section
      data-slot="section-descriptor"
      className={cn(SECTION_DESCRIPTOR, className)}
      {...props}
    >
      <div data-slot="section-descriptor-title" className={FIELD_TITLE}>
        {titleContent}
      </div>
      <p data-slot="section-descriptor-body" className={FIELD_DESCRIPTION}>
        {children}
      </p>
    </section>
  );
}
