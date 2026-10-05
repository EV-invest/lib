import { cn } from "@evinvest/uikit";
import type { FormEventHandler, KeyboardEventHandler, ReactNode } from "react";
import { FORM_ID_FIELD, LOCALE_FIELD, LOCATION_FIELD } from "../core/accept";
import { HONEYPOT_FIELD, RENDERED_AT_FIELD } from "../core/antispam";
import { CARD_FIELD, SUBMISSION_FIELD } from "../core/lead";

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
  /** The card's anchor, posted so a refusal lands back on it (`quoteRoute`). */
  card?: string | undefined;
  action?: string;
  id?: string;
  className?: string;
  /** A script's own submit (an in-place success); the 303 stays the path without one. */
  onSubmit?: FormEventHandler<HTMLFormElement> | undefined;
  /** A key in any field — `LeadCapture`'s Enter that moves to the next field. */
  onKeyDown?: KeyboardEventHandler<HTMLFormElement> | undefined;
  /** Bare `data-*` attributes on the form, for a stylesheet of the caller's. */
  data?: Readonly<Record<`data-${string}`, string>> | undefined;
  children: ReactNode;
}

/** The mobile field's attributes: the numeric keypad and the phone's autofill. */
export const PHONE_INPUT_PROPS = { type: "tel", inputMode: "tel", autoComplete: "tel" } as const;

export function QuoteFormShell(props: QuoteFormShellProps) {
  const { placeSlug, locale, renderedAt, honeypotLabel, formId = "quote", card, action = "/quote", id = "quote", className, onSubmit, onKeyDown, children } = props;
  return (
    <form id={id} method="post" action={action} onSubmit={onSubmit} onKeyDown={onKeyDown} {...props.data} className={cn("relative flex w-full flex-col gap-5", className)}>
      {placeSlug && <input type="hidden" name={LOCATION_FIELD} value={placeSlug} />}
      <input type="hidden" name={LOCALE_FIELD} value={locale} />
      <input type="hidden" name={FORM_ID_FIELD} value={formId} />
      <input type="hidden" name={RENDERED_AT_FIELD} value={String(renderedAt)} />
      {card && <input type="hidden" name={CARD_FIELD} value={card} />}
      {/* Empty until the script posts the form: it mints the id then and keeps
          it for a resend. No value prop — React would put it back on render. */}
      <input type="hidden" name={SUBMISSION_FIELD} />
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
