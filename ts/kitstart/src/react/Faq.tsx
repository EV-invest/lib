import { cn } from "@evinvest/uikit";
import type { ReactNode } from "react";
import type { QuestionAnswer } from "../core/seo/ld";

/**
 * `<details>`, not an accordion component: it opens without hydration, is
 * keyboard- and screen-reader-correct for free, and the FAQPage JSON-LD
 * (`faqPageNode`) reads the same strings.
 */
export interface FaqProps {
  items: readonly QuestionAnswer[];
  head?: ReactNode;
  id?: string;
  className?: string;
}

export function Faq({ items, head, id = "faq", className }: FaqProps) {
  return (
    <div id={id} className={cn("flex flex-col gap-6 md:gap-11", className)}>
      {head}
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        {items.map(item => (
          <details key={item.q} className="group border-b border-border last:border-b-0">
            <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-5 md:px-8 md:py-6">
              <span className="flex-1 font-display text-lg font-bold leading-snug text-ink">{item.q}</span>
              <span className="text-lg text-primary-ink transition-transform group-open:rotate-45" aria-hidden="true">
                +
              </span>
            </summary>
            <p className="px-5 pb-5 text-base leading-relaxed text-ink-soft md:px-8 md:pb-6">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
