"use client";

import { useEffect, useState, type RefObject } from "react";
import { PRICE_CHANGED } from "../core/accept";
import { LEAD_CARD_PARAM, LEAD_ERROR_FIELD, LEAD_ERROR_PARAM, type LeadChannel, type LeadError } from "../core/lead";
import type { LeadCaptureText } from "../core/lead-capture-text";

export type { LeadError };

/** The fields `LeadCapture` draws itself, which show a refusal under themselves. */
export const OWN_FIELDS: Readonly<Record<LeadChannel, readonly string[]>> = { form: ["phone", "locality", "name"], callback: ["phone", "consent"] };

/** The id of the message a refusal of a field the card does not draw is shown in, above the submit. */
export const formMessageId = (id: string, channel: LeadChannel): string => (channel === "callback" ? `${id}-callback-error` : `${id}-error`);

/** The words for a refused field: the field's own rule where the form has one. */
export function errorText(field: string, text: LeadCaptureText): string {
  if (field === "phone") return text.phoneInvalid;
  if (field === "consent") return text.consentRequired;
  if (field === "need") return text.needRequired;
  if (field === "form") return text.formInvalid;
  return text.fieldInvalid;
}

/** The control a refusal is about: by its role, then by its posted name. */
function controlOf(form: HTMLFormElement, field: string): HTMLElement | null {
  return form.querySelector<HTMLElement>(`[data-lead-field="${field}"]`) ?? form.querySelector<HTMLElement>(`[name="${CSS.escape(field)}"]`);
}

/**
 * The server's refusal, for the card `id`: read once from the page's query
 * when the 303 brought the visitor back (`?lead_error=phone#<id>`, or
 * `#<id>-callback`) — then taken out of the URL, so a reload does not show it
 * again — or set by the script's own post. The refused control takes the
 * focus; a control the card does not draw (a brand's extra) is marked
 * `aria-invalid` and pointed at the message above the submit. Fixing that
 * control clears it.
 */
export function useLeadError(root: RefObject<HTMLElement | null>, id: string, initial: LeadError | null = null): [LeadError | null, (error: LeadError | null) => void] {
  // Drawn on the server too when the page read it from its query (`leadErrorOf`).
  const [error, setError] = useState<LeadError | null>(initial);

  useEffect(() => {
    const url = new URL(window.location.href);
    const field = url.searchParams.get(LEAD_ERROR_PARAM);
    const channel = url.hash === `#${id}` ? "form" : url.hash === `#${id}-callback` ? "callback" : null;
    if (field === null || channel === null) return;
    url.searchParams.delete(LEAD_ERROR_PARAM);
    url.searchParams.delete(LEAD_CARD_PARAM);
    window.history.replaceState(window.history.state, "", url);
    if (LEAD_ERROR_FIELD.test(field)) setError({ channel, field });
  }, [id]);

  useEffect(() => {
    const form = error && root.current?.querySelector<HTMLFormElement>(`#${CSS.escape(error.channel === "callback" ? `${id}-callback-form` : `${id}-form`)}`);
    if (!error || !form) return;
    const details = form.closest("details");
    if (details) details.open = true;
    const control = controlOf(form, error.field);
    const foreign = control && !OWN_FIELDS[error.channel].includes(error.field) ? control : null;
    foreign?.setAttribute("aria-invalid", "true");
    foreign?.setAttribute("aria-describedby", formMessageId(id, error.channel));
    (control ?? document.getElementById(formMessageId(id, error.channel)))?.focus();
    const fixed = (event: Event) => {
      // A refusal of the whole form, or of its price, is about every answer: any change answers it.
      if (error.field === "form" || error.field === PRICE_CHANGED || (event.target instanceof Element && control?.contains(event.target))) setError(null);
    };
    form.addEventListener("input", fixed);
    form.addEventListener("change", fixed);
    return () => {
      form.removeEventListener("input", fixed);
      form.removeEventListener("change", fixed);
      foreign?.removeAttribute("aria-invalid");
      foreign?.removeAttribute("aria-describedby");
    };
  }, [error, id, root]);

  return [error, setError];
}
