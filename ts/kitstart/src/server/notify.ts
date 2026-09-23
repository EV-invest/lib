import "server-only";
import type { Lead } from "../core/lead";
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

/** A plain default; a brand passes `format` to write it in its own language. */
export function defaultLeadMail(brand: Pick<BrandFacts, "name">, lead: Lead, id: number): LeadMail {
  const place = lead.placeSlug ?? "unknown";
  return {
    subject: `${brand.name} — new lead (${place})`,
    text: [
      `Lead #${id} — place ${place}${lead.spamVerdict ? ` — suspect (${lead.spamVerdict})` : ""}`,
      "",
      `Subject  : ${lead.subject}`,
      `Locality : ${lead.locality}`,
      `Mobile   : ${lead.mobile}`,
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
    format?: (lead: Lead, id: number) => LeadMail;
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
  const format = options.format ?? ((lead: Lead, id: number) => defaultLeadMail(brand, lead, id));
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
        const { subject, text } = format(lead, id);
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
