"use client";

import { useRef, useState, type FormEvent, type FormEventHandler } from "react";
import { CHANNEL_FIELD } from "../core/lead";
import { THANKS } from "../core/routing";

/** What the visitor just sent, for a brand's in-card success ("we call 06 … back"). */
export interface LeadSent {
  channel: "form" | "callback";
  /** As typed. */
  phone: string;
  /** The name field's value, when the form has one and it was filled. */
  name: string | null;
}

/**
 * The lead posted by a script, so the card can say "done" in place. The body
 * and the endpoint are the form's own, and the server answers it as it answers
 * the plain post: a 303 to the thanks page means the lead was taken. Anything
 * else — a refusal, the store's 500, no network — submits the form for real,
 * so the server's own page says what went wrong. Off (`undefined` handler)
 * when the brand gave no in-card success: the 303 to `/thanks` stays the path.
 */
export function useLeadSubmit(enabled: boolean, fields: { mobile: string; name: string | undefined }): [LeadSent | null, FormEventHandler<HTMLFormElement> | undefined] {
  const [sent, setSent] = useState<LeadSent | null>(null);
  const pending = useRef(false);
  if (!enabled) return [sent, undefined];

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = new URLSearchParams();
    for (const [key, value] of data) if (typeof value === "string") body.append(key, value);
    const read = (field: string | undefined) => {
      const value = field === undefined ? null : data.get(field);
      return typeof value === "string" ? value.trim() : "";
    };
    const lead: LeadSent = { channel: read(CHANNEL_FIELD) === "callback" ? "callback" : "form", phone: read(fields.mobile), name: read(fields.name) || null };
    // `form.submit()` neither validates again nor comes back here.
    const fallBack = () => {
      pending.current = false;
      form.submit();
    };
    fetch(form.action, { method: "POST", body }).then(
      res => (res.ok && res.redirected && new URL(res.url).pathname.endsWith(THANKS) ? setSent(lead) : fallBack()),
      fallBack,
    );
  };
  return [sent, submit];
}
