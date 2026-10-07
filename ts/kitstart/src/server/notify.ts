import "server-only";
import { channelOf, type Lead } from "../core/lead";
import type { BrandFacts } from "../core/site";
import type { ServerEnv } from "./env";
import { parseSmtpUrl, sendMail } from "./smtp";

/**
 * Telling the business a lead arrived. Called only after the lead is stored,
 * and allowed to fail: a lead on disk but un-notified is recoverable; a 500
 * shown to a customer whose lead we already hold is not.
 */
export interface LeadNotifier {
  notify(lead: Lead, id: number): Promise<void>;
}

export interface LeadMail {
  subject: string;
  text: string;
}

export type NotifyEnv = Pick<ServerEnv, "smtpUrl" | "notifyTo" | "notifyFrom" | "smsToken">;

/**
 * The need's label in the mail's language — the business's, whatever the
 * visitor's — or `undefined` for one it does not know (a stale form's).
 */
export type NeedLabel = (need: string) => string | undefined;

/** What a mail shows in place of the raw lead: the need as `needLabel` names it, else its id. */
export interface LeadMailShown {
  need: string;
}

const shownOf = (lead: Lead, needLabel: NeedLabel | undefined): LeadMailShown => ({ need: needLabel?.(lead.subject) ?? lead.subject });

/** A plain default; a brand passes `format` to write it in its own language. */
export function defaultLeadMail(brand: Pick<BrandFacts, "name">, lead: Lead, id: number, options: { needLabel?: NeedLabel | undefined } = {}): LeadMail {
  const place = lead.placeSlug ?? "unknown";
  // A callback request is a promise to ring the customer: it says so first. A
  // messenger lead says where the customer will write, and the reference the
  // message carries — what the operator matches the chat by.
  const channel = channelOf(lead);
  const messenger = channel === "whatsapp" ? "WhatsApp" : channel === "telegram" ? "Telegram" : null;
  const kind = channel === "callback" ? "call back" : messenger ? `${messenger} lead` : "new lead";
  const flag = channel === "callback" ? " — CALL BACK" : messenger ? ` — ${messenger.toUpperCase()}` : "";
  return {
    subject: `${brand.name} — ${kind} (${place})`,
    text: [
      `Lead #${id} — place ${place}${flag}${lead.spamVerdict ? ` — suspect (${lead.spamVerdict})` : ""}`,
      "",
      ...(lead.messageRef ? [`Réf.     : ${lead.messageRef}`] : []),
      `Subject  : ${shownOf(lead, options.needLabel).need}`,
      `Locality : ${lead.locality}`,
      `Mobile   : ${lead.mobile || (messenger ? `(none — answer on ${messenger})` : "")}`,
      ...Object.entries(lead.extras).map(([name, value]) => `${name} : ${value}`),
    ].join("\n"),
  };
}

/**
 * Checked when it is built — at boot, when a brand builds it there — not on
 * the first lead: with SMTP configured, a sender needs a domain to be `leads@`
 * of (or `LEAD_NOTIFY_FROM`), and a recipient needs the brand's mailbox (or
 * `LEAD_NOTIFY_TO`). A site before launch has neither, and `leads@null` is a
 * mail no relay delivers.
 */
/** Mails a notifier sends per minute, per process; past it the lead is only logged. */
export const MAIL_PER_MINUTE = 20;

export function leadNotifier(
  site: { brand: BrandFacts },
  env: NotifyEnv,
  options: {
    /** The brand's mail; `shown.need` is the need's label (`needLabel`), else its id. */
    format?: (lead: Lead, id: number, shown: LeadMailShown) => LeadMail;
    /**
     * Names the need in the mail — `lead.subject` is the id the form posted
     * (`hot_water`), which the business should not have to decode. The labels
     * the brand hands `LeadCapture` as `needs`, in the mail's language.
     */
    needLabel?: NeedLabel;
    log?: Pick<Console, "warn">;
    /** `MAIL_PER_MINUTE` by default: a flood that passes the antispam must not become a mail flood. */
    mailPerMinute?: number;
    now?: () => number;
  } = {},
): LeadNotifier {
  const { brand } = site;
  const log = options.log ?? console;
  const now = options.now ?? Date.now;
  const cap = options.mailPerMinute ?? MAIL_PER_MINUTE;
  const { needLabel } = options;
  const format = options.format ?? ((lead: Lead, id: number) => defaultLeadMail(brand, lead, id, { needLabel }));
  let window = { start: Number.NEGATIVE_INFINITY, sent: 0 };
  const spend = (): boolean => {
    const t = now();
    if (t - window.start >= 60_000) window = { start: t, sent: 0 };
    window.sent += 1;
    return window.sent <= cap;
  };
  let mail: { url: URL; from: string; to: string; helo: string } | null = null;
  if (env.smtpUrl) {
    const from = env.notifyFrom ?? (brand.domain ? `leads@${brand.domain}` : null);
    if (!from) throw new Error("SMTP_URL is set but the site has no domain: set LEAD_NOTIFY_FROM");
    const to = env.notifyTo ?? brand.email;
    if (!to) throw new Error("SMTP_URL is set but the brand has no email: set LEAD_NOTIFY_TO");
    const helo = brand.domain ?? from.split("@")[1] ?? "localhost";
    mail = { url: parseSmtpUrl(env.smtpUrl), from, to, helo };
  }
  return {
    async notify(lead, id) {
      const channels: Promise<void>[] = [];
      if (mail && !spend()) {
        log.warn(`lead ${id}: over ${cap} notification mails a minute; stored, not mailed`);
      } else if (mail) {
        const { subject, text } = format(lead, id, shownOf(lead, needLabel));
        channels.push(sendMail(mail.url, { from: mail.from, to: mail.to, subject, text }, { helo: mail.helo }));
      }
      if (env.smsToken) {
        // No SMS provider is chosen; the token is read so a deployment can
        // already carry it, and the lead is still mailed.
        log.warn(`lead ${id}: SMS_TOKEN is set but no SMS provider is wired; not texted`);
      }
      if (channels.length === 0 && !mail) {
        log.warn(`lead ${id}: no notification channel configured; the lead is stored and unsent`);
        return;
      }
      if (channels.length === 0) return;
      const results = await Promise.allSettled(channels);
      const failure = results.find(r => r.status === "rejected");
      if (failure) throw failure.reason;
    },
  };
}
