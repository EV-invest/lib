"use client";

import { useRef, useState, type FormEvent, type FormEventHandler } from "react";
import { CHANNEL_FIELD, type LeadChannel } from "../core/lead";
import { THANKS } from "../core/routing";

/** What the visitor just sent, for a brand's in-card success ("we call 06 … back"). */
export interface LeadSent {
  channel: LeadChannel;
  /** As typed. */
  phone: string;
  /** The name field's value, when the form has one and it was filled. */
  name: string | null;
}

/** Leaving the page, behind a seam a test can stand in for (jsdom cannot navigate). */
export const navigation = { assign: (url: string): void => window.location.assign(url) };

type Answer = { ok: true; location: string } | { ok: false; field: string };

/** A root-relative path on this origin — never `//elsewhere`. */
const OWN_PATH = /^\/(?!\/)/;

/**
 * The route's answer to a script (`quoteRoute`): JSON when it asked for it,
 * or — through a proxy that rewrote nothing but followed the 303 — the
 * thanks page itself. Anything else is not an answer: `null`.
 */
async function readAnswer(res: Response): Promise<Answer | null> {
  if ((res.ok || res.status === 422) && (res.headers.get("content-type") ?? "").includes("application/json")) {
    const body: unknown = await res.json().catch(() => null);
    if (typeof body !== "object" || body === null) return null;
    const { ok, location, field } = body as Record<string, unknown>;
    if (ok === true && typeof location === "string" && OWN_PATH.test(location)) return { ok, location };
    if (ok === false && typeof field === "string") return { ok, field };
    return null;
  }
  if (res.ok && res.redirected) {
    const url = new URL(res.url);
    if (url.pathname.endsWith(THANKS)) return { ok: true, location: `${url.pathname}${url.search}` };
  }
  return null;
}

/**
 * The lead posted by a script, so a refusal keeps what was typed: the body
 * and the endpoint are the form's own, asked for JSON. Taken → the brand's
 * in-card success when it has one (`done`), else the thanks page the route
 * names. Refused → `onRefused` with the field, the form as it was. Anything
 * else — the store's 500, no network — submits the form for real, so the
 * server's own page says what went wrong.
 */
export function useLeadSubmit(
  done: boolean,
  fields: { mobile: string; name: string | undefined },
  onRefused: (channel: LeadChannel, field: string) => void,
): [LeadSent | null, FormEventHandler<HTMLFormElement>] {
  const [sent, setSent] = useState<LeadSent | null>(null);
  const pending = useRef(false);

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
    fetch(form.action, { method: "POST", body, headers: { Accept: "application/json" } })
      .then(readAnswer)
      .then(answer => {
        if (answer === null) return fallBack();
        if (!answer.ok) {
          pending.current = false;
          return onRefused(lead.channel, answer.field);
        }
        // Still pending: the page is leaving, or the form is gone.
        if (done) setSent(lead);
        else navigation.assign(answer.location);
      }, fallBack);
  };
  return [sent, submit];
}
