import { cn } from "@evinvest/uikit";
import type { ReactNode } from "react";
import { FORM_ID_FIELD, LOCALE_FIELD, LOCATION_FIELD } from "../core/accept";
import { HONEYPOT_FIELD, RENDERED_AT_FIELD } from "../core/antispam";

/**
 * The quote form's frame: a plain `<form method="post" action="/quote">`
 * answered with a 303, so it works before any JavaScript arrives — which is
 * when the visitor standing in water submits it. The shell owns what the
 * funnel reads (the hidden place, locale, form id and render stamp, and the
 * honeypot); the visible fields and the submit button are the brand's
 * `children`, named after `site.lead.wire`.
 */
export interface QuoteFormShellProps {
  /** The place the lead is for, or `null` on the brand's own pages. */
  placeSlug: string | null;
  locale: string;
  /**
   * When the page rendered, ms since the epoch: the time trap's stamp. Under
   * ISR that is when the cache was filled, not when the visitor arrived — so
   * the stamp only ever marks a lead `too-fast`, it never withholds one.
   */
  renderedAt: number;
  /** The honeypot's label — read only by a bot filling every field. */
  honeypotLabel: string;
  formId?: string;
  action?: string;
  id?: string;
  className?: string;
  children: ReactNode;
}

/** The mobile field's attributes: the numeric keypad and the phone's autofill. */
export const PHONE_INPUT_PROPS = { type: "tel", inputMode: "tel", autoComplete: "tel" } as const;

export function QuoteFormShell(props: QuoteFormShellProps) {
  const { placeSlug, locale, renderedAt, honeypotLabel, formId = "quote", action = "/quote", id = "quote", className, children } = props;
  return (
    <form id={id} method="post" action={action} className={cn("relative flex w-full flex-col gap-5", className)}>
      {placeSlug && <input type="hidden" name={LOCATION_FIELD} value={placeSlug} />}
      <input type="hidden" name={LOCALE_FIELD} value={locale} />
      <input type="hidden" name={FORM_ID_FIELD} value={formId} />
      <input type="hidden" name={RENDERED_AT_FIELD} value={String(renderedAt)} />
      {children}
      {/* Off-screen rather than `display: none`, which some bots skip. Inline,
          so it holds even when Tailwind does not scan the package. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          {honeypotLabel}
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
    </form>
  );
}
