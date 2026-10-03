"use client";

import { useRef, useState, type FormEvent, type FormEventHandler } from "react";
import { CHANNEL_FIELD, SUBMISSION_FIELD, type LeadChannel } from "../core/lead";
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

/**
 * A v4 UUID. `randomUUID` exists only in a secure context; a LAN dev server
 * over plain http is not one, but `getRandomValues` works everywhere.
 */
export function newSubmissionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The form's submission id, minted on its first post and kept for a resend of the same lead. */
function stamp(form: HTMLFormElement): void {
  const field = form.elements.namedItem(SUBMISSION_FIELD);
  if (field instanceof HTMLInputElement && field.value === "") field.value = newSubmissionId();
}

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

/** Why the script's post got no answer: none came back (`network`), or none in time (`timeout`). */
export type SendFailure = "network" | "timeout";

/** How long the script waits for `/quote` before it says so; the lead is a few short fields. */
export const SUBMIT_TIMEOUT_MS = 15_000;

export interface LeadSubmitHandlers {
  /** The route refused the lead: the field to fix. */
  onRefused: (channel: LeadChannel, field: string) => void;
  /** No answer: the form stays as typed, with a retry. */
  onFailed: (channel: LeadChannel, failure: SendFailure) => void;
}

export interface LeadSubmit {
  sent: LeadSent | null;
  onSubmit: FormEventHandler<HTMLFormElement>;
  /** The form being posted, while it is. */
  busy: LeadChannel | null;
  /** The last post that got no answer, until the next one. */
  failure: { channel: LeadChannel; failure: SendFailure } | null;
  /** Posts that form again — the same submission id, so never a second lead. */
  retry: () => void;
}

/**
 * The lead posted by a script, so a refusal keeps what was typed: the body
 * and the endpoint are the form's own, asked for JSON. Taken → the brand's
 * in-card success when it has one (`done`), else the thanks page the route
 * names. Refused → `onRefused` with the field, the form as it was. No answer
 * — no network, or nothing in `SUBMIT_TIMEOUT_MS` — is said in place with a
 * retry, never by leaving the page: the browser's error page would lose the
 * form. Any other answer (the store's 500) submits the form for real, so the
 * server's own page says what went wrong; the submission id makes that safe.
 */
export function useLeadSubmit(done: boolean, fields: { mobile: string; name: string | undefined }, on: LeadSubmitHandlers): LeadSubmit {
  const [sent, setSent] = useState<LeadSent | null>(null);
  const [busy, setBusy] = useState<LeadChannel | null>(null);
  const [failure, setFailure] = useState<LeadSubmit["failure"]>(null);
  const pending = useRef(false);
  const last = useRef<HTMLFormElement | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    const form = event.currentTarget;
    last.current = form;
    stamp(form);
    const data = new FormData(form);
    const body = new URLSearchParams();
    for (const [key, value] of data) if (typeof value === "string") body.append(key, value);
    const read = (field: string | undefined) => {
      const value = field === undefined ? null : data.get(field);
      return typeof value === "string" ? value.trim() : "";
    };
    const lead: LeadSent = { channel: read(CHANNEL_FIELD) === "callback" ? "callback" : "form", phone: read(fields.mobile), name: read(fields.name) || null };
    setBusy(lead.channel);
    setFailure(null);
    const settle = () => {
      pending.current = false;
      setBusy(null);
    };
    // `form.submit()` neither validates again nor comes back here.
    const fallBack = () => {
      settle();
      form.submit();
    };
    // A controller and a timer rather than `AbortSignal.timeout`: one clock the page (and a test) controls.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException("no answer in time", "TimeoutError")), SUBMIT_TIMEOUT_MS);
    fetch(form.action, { method: "POST", body, headers: { Accept: "application/json" }, signal: controller.signal })
      .then(readAnswer)
      .then(
        answer => {
          if (answer === null) return fallBack();
          if (!answer.ok) {
            settle();
            return on.onRefused(lead.channel, answer.field);
          }
          // Still pending: the page is leaving, or the form is gone.
          if (done) setSent(lead);
          else navigation.assign(answer.location);
        },
        () => {
          settle();
          const kind: SendFailure = controller.signal.aborted ? "timeout" : "network";
          setFailure({ channel: lead.channel, failure: kind });
          on.onFailed(lead.channel, kind);
        },
      )
      .finally(() => clearTimeout(timer));
  };
  const retry = () => last.current?.requestSubmit();
  return { sent, onSubmit: submit, busy, failure, retry };
}
