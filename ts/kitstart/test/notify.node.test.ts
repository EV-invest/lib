import { createServer, type AddressInfo, type Server } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrandFacts, Lead } from "../src/index";
import { defaultLeadMail, leadNotifier } from "../src/server/index";

const BRAND: BrandFacts = {
  id: "aquafix",
  name: "Aquafix",
  legalName: "Aquafix SAS",
  email: "val@aquafix.top",
  phone: "+33 4 23 50 06 40",
  domain: "aquafix.top",
  businessType: "Plumber",
};
const NONE = { smtpUrl: null, notifyTo: null, notifyFrom: null, smsToken: null };
const lead: Lead = { subject: "hot_water", locality: "63130", mobile: "0612", extras: { floor: "3" }, placeSlug: "royat", spamVerdict: null };

let server: Server | undefined;
afterEach(() => new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve())));

/** A loopback SMTP catcher that records every line. */
function catcher(): Promise<{ port: number; lines: string[] }> {
  const lines: string[] = [];
  const s = createServer(socket => {
    let data = false;
    let buffer = "";
    socket.write("220 hi\r\n");
    socket.on("data", chunk => {
      buffer += chunk.toString("utf8");
      let end: number;
      while ((end = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        lines.push(line);
        if (data) {
          if (line === ".") {
            data = false;
            socket.write("250 ok\r\n");
          }
        } else if (line.startsWith("EHLO")) socket.write("250 fake\r\n");
        else if (line === "DATA") {
          data = true;
          socket.write("354 go\r\n");
        } else if (line === "QUIT") socket.end("221 bye\r\n");
        else socket.write("250 ok\r\n");
      }
    });
  });
  server = s;
  return new Promise(resolve => s.listen(0, "127.0.0.1", () => resolve({ port: (s.address() as AddressInfo).port, lines })));
}

describe("the lead notifier's mail cap", () => {
  it("mails at most mailPerMinute a minute per process, then only logs", async () => {
    const { port, lines } = await catcher();
    const warn = vi.fn();
    let t = 0;
    const notifier = leadNotifier({ brand: BRAND }, { ...NONE, smtpUrl: `smtp://127.0.0.1:${port}` }, { mailPerMinute: 2, now: () => t, log: { warn } });
    for (let i = 1; i <= 3; i++) await notifier.notify(lead, i);
    expect(lines.filter(l => l.startsWith("MAIL FROM"))).toHaveLength(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("over 2 notification mails a minute"));
    t = 60_000;
    await notifier.notify(lead, 4);
    expect(lines.filter(l => l.startsWith("MAIL FROM"))).toHaveLength(3);
  });

  it("refuses a malformed SMTP_URL at construction, without repeating it", () => {
    expect(() => leadNotifier({ brand: BRAND }, { ...NONE, smtpUrl: "ftp://u:secret@x" })).toThrow(/unsupported scheme/);
    expect(() => leadNotifier({ brand: BRAND }, { ...NONE, smtpUrl: "not a url secret" })).toThrow(/^SMTP_URL is not a URL$/);
  });
});

describe("the lead notifier", () => {
  it("refuses at construction to mail from a site with no domain, or to a brand with no mailbox", () => {
    const smtp = { ...NONE, smtpUrl: "smtp://127.0.0.1:2525" };
    expect(() => leadNotifier({ brand: { ...BRAND, domain: null } }, smtp)).toThrow(/LEAD_NOTIFY_FROM/);
    expect(() => leadNotifier({ brand: { ...BRAND, email: null } }, smtp)).toThrow(/LEAD_NOTIFY_TO/);
    expect(() => leadNotifier({ brand: { ...BRAND, domain: null, email: null } }, { ...smtp, notifyFrom: "a@b.fr", notifyTo: "c@d.fr" })).not.toThrow();
    // Without SMTP there is nothing to check.
    expect(() => leadNotifier({ brand: { ...BRAND, domain: null } }, NONE)).not.toThrow();
  });

  it("warns, and does not throw, when no channel is configured", async () => {
    const warn = vi.fn();
    await leadNotifier({ brand: BRAND }, NONE, { log: { warn } }).notify(lead, 1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no notification channel"));
  });

  it("mails the lead from leads@<domain> to the brand, in the brand's own words", async () => {
    const { port, lines } = await catcher();
    const notifier = leadNotifier({ brand: BRAND }, { ...NONE, smtpUrl: `smtp://127.0.0.1:${port}` }, {
      format: (l, id) => ({ subject: `Demande #${id}`, text: `Commune : ${l.locality}` }),
    });
    await notifier.notify(lead, 7);
    expect(lines).toContain("MAIL FROM:<leads@aquafix.top>");
    expect(lines).toContain("RCPT TO:<val@aquafix.top>");
    expect(lines).toContain("Subject: Demande #7");
    expect(lines).toContain(Buffer.from("Commune : 63130").toString("base64"));
  });

  it("names the need by its label, the id when it has none", async () => {
    const labels: Record<string, string> = { hot_water: "Eau chaude" };
    const needLabel = (need: string) => labels[need];
    expect(defaultLeadMail(BRAND, lead, 1, { needLabel }).text).toContain("Subject  : Eau chaude\n");
    // A stale form's need, or none given: the id, as before.
    expect(defaultLeadMail(BRAND, { ...lead, subject: "gone" }, 1, { needLabel }).text).toContain("Subject  : gone\n");
    expect(defaultLeadMail(BRAND, lead, 1).text).toContain("Subject  : hot_water\n");

    const { port, lines } = await catcher();
    const smtp = { ...NONE, smtpUrl: `smtp://127.0.0.1:${port}` };
    await leadNotifier({ brand: BRAND }, smtp, { needLabel }).notify(lead, 2);
    // The body: base64 lines between the headers' blank line and the closing dot.
    const body = Buffer.from(lines.slice(lines.indexOf("") + 1, lines.indexOf(".")).join(""), "base64").toString("utf8");
    expect(body).toContain("Subject  : Eau chaude");
    // A brand's own format is handed the label too.
    const format = vi.fn((_l: Lead, id: number, shown: { need: string }) => ({ subject: `#${id}`, text: `Intervention : ${shown.need}` }));
    await leadNotifier({ brand: BRAND }, smtp, { needLabel, format }).notify(lead, 3);
    expect(format).toHaveBeenCalledWith(lead, 3, { need: "Eau chaude" });
  });

  it("says a callback request is one, first, in the default mail", () => {
    expect(defaultLeadMail(BRAND, lead, 3).subject).toBe(`${BRAND.name} — new lead (royat)`);
    const mail = defaultLeadMail(BRAND, { ...lead, channel: "callback" }, 3);
    expect(mail.subject).toBe(`${BRAND.name} — call back (royat)`);
    expect(mail.text.split("\n")[0]).toContain("CALL BACK");
  });
});
