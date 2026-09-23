import "server-only";
import { connect as tcp, type Socket } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";
import { randomUUID } from "node:crypto";

/**
 * A minimal SMTP submission client: one message, plain text, AUTH PLAIN,
 * STARTTLS when offered. Enough to tell a plumber a lead arrived, without a
 * mail library in the dependency tree.
 *
 * `smtps://user:pass@host:465` is implicit TLS; `smtp://…:587` upgrades with
 * STARTTLS, and refuses to send anything when the server offers no TLS —
 * unless the host is loopback, a local mail catcher.
 */
export interface Mail {
  from: string;
  to: string;
  subject: string;
  text: string;
}

/** The whole conversation, connect to QUIT. */
const TOTAL_TIMEOUT_MS = 20_000;

class Replies {
  private buffer = "";
  private waiting: ((reply: { code: number; text: string }) => void)[] = [];
  private queued: { code: number; text: string }[] = [];

  private readonly onData = (chunk: Buffer) => this.feed(chunk.toString("utf8"));

  constructor(private socket: Socket | TLSSocket) {
    socket.on("data", this.onData);
  }

  private feed(data: string): void {
    this.buffer += data;
    let end: number;
    let lines: string[] = [];
    while ((end = this.buffer.indexOf("\r\n")) >= 0) {
      const line = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 2);
      lines.push(line);
      // `250-…` continues a reply, `250 …` ends it.
      if (/^\d{3}(?: |$)/.test(line)) {
        const reply = { code: Number(line.slice(0, 3)), text: lines.join("\n") };
        lines = [];
        const next = this.waiting.shift();
        if (next) next(reply);
        else this.queued.push(reply);
      }
    }
    if (lines.length) this.buffer = `${lines.join("\r\n")}\r\n${this.buffer}`;
  }

  next(): Promise<{ code: number; text: string }> {
    const ready = this.queued.shift();
    if (ready) return Promise.resolve(ready);
    return new Promise(resolve => this.waiting.push(resolve));
  }

  /** Before STARTTLS: the raw socket is about to carry ciphertext. */
  detach(): void {
    this.socket.off("data", this.onData);
    this.buffer = "";
    this.queued = [];
  }

  attach(socket: Socket | TLSSocket): void {
    this.socket = socket;
    socket.on("data", this.onData);
  }
}

function encodeHeader(value: string): string {
  // RFC 2047: a subject with an accent or a place name is not 7-bit.
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

async function open(url: URL, watch: (s: Socket | TLSSocket) => void): Promise<Socket | TLSSocket> {
  const implicit = url.protocol === "smtps:";
  const port = Number(url.port || (implicit ? 465 : 587));
  const host = hostOf(url);
  const socket = implicit ? tlsConnect({ host, port, servername: host }) : tcp({ host, port });
  watch(socket);
  await new Promise<void>(resolve => socket.once(implicit ? "secureConnect" : "connect", () => resolve()));
  return socket;
}

function message(mail: Mail): string {
  const body = Buffer.from(mail.text, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
  const domain = mail.from.split("@")[1] ?? "localhost";
  return [
    `From: ${mail.from}`,
    `To: ${mail.to}`,
    `Subject: ${encodeHeader(mail.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    // Without one, some relays add their own and some spam filters score it.
    `Message-ID: <${randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");
}

const LOOPBACK = ["localhost", "127.0.0.1", "::1"];

/** `URL.hostname` keeps an IPv6 literal's brackets; sockets want it bare. */
const hostOf = (url: URL): string => url.hostname.replace(/^\[(.*)\]$/, "$1");

/**
 * Sends one message or rejects. Every way the conversation can die rejects
 * rather than hangs: an error or a close on either socket (the raw one, and
 * the TLS one over it after STARTTLS), and one deadline over the whole
 * exchange — a server that accepts the connection and then says nothing must
 * not hold a request's `after()` task forever.
 *
 * Off loopback, TLS is required: implicit (`smtps://`) or STARTTLS. A server
 * that offers neither gets nothing — not the credentials, and not the
 * customer's phone number in the body. The lead is already stored, so a
 * refusal here is loud in the log and costs nothing else.
 *
 * `helo` is the name this client greets a remote relay with — the site's own
 * domain; a loopback catcher is greeted as `localhost`.
 */
/** `SMTP_URL`, checked; the error never repeats it, since it carries the password. */
export function parseSmtpUrl(value: string | URL): URL {
  let url: URL;
  try {
    url = value instanceof URL ? value : new URL(value);
  } catch {
    throw new Error("SMTP_URL is not a URL");
  }
  if (url.protocol !== "smtp:" && url.protocol !== "smtps:") throw new Error(`SMTP_URL: unsupported scheme ${url.protocol}`);
  if (!url.hostname) throw new Error("SMTP_URL: no host");
  return url;
}

export interface SendOptions {
  helo: string;
  timeoutMs?: number;
}

export async function sendMail(smtpUrl: string | URL, mail: Mail, options: SendOptions): Promise<void> {
  const timeoutMs = options.timeoutMs ?? TOTAL_TIMEOUT_MS;
  const url = parseSmtpUrl(smtpUrl);
  const deadline = AbortSignal.timeout(timeoutMs);
  let fail: (e: Error) => void = () => undefined;
  const failed = new Promise<never>((_, reject) => (fail = reject));
  // Handled here so a failure after the last exchange is not an unhandled
  // rejection; every step still races against it.
  failed.catch(() => undefined);
  const sockets: (Socket | TLSSocket)[] = [];
  const watch = (s: Socket | TLSSocket) => {
    sockets.push(s);
    s.on("error", fail);
    s.once("close", () => fail(new Error("smtp: connection closed")));
  };
  deadline.addEventListener("abort", () => {
    fail(new Error(`smtp: no answer within ${timeoutMs} ms`));
    for (const s of sockets) s.destroy();
  });

  let socket = await Promise.race([open(url, watch), failed]);
  const replies = new Replies(socket);
  const step = <T>(p: Promise<T>) => Promise.race([p, failed]);
  const expect = async (ok: (code: number) => boolean, what: string) => {
    const reply = await step(replies.next());
    if (!ok(reply.code)) throw new Error(`smtp: ${what} refused: ${reply.text}`);
    return reply;
  };
  const say = (line: string) => socket.write(`${line}\r\n`);
  const hello = url.hostname.includes(".") ? options.helo : "localhost";
  const loopback = LOOPBACK.includes(hostOf(url));
  let done = false;
  try {
    await expect(c => c === 220, "greeting");
    say(`EHLO ${hello}`);
    const caps = await expect(c => c === 250, "EHLO");
    let encrypted = url.protocol === "smtps:";
    if (!encrypted && /STARTTLS/i.test(caps.text)) {
      say("STARTTLS");
      await expect(c => c === 220, "STARTTLS");
      replies.detach();
      const raw = socket;
      socket = tlsConnect({ socket: raw, servername: hostOf(url) });
      watch(socket);
      await step(new Promise<void>(resolve => socket.once("secureConnect", () => resolve())));
      encrypted = true;
      replies.attach(socket);
      say(`EHLO ${hello}`);
      await expect(c => c === 250, "EHLO after STARTTLS");
    }
    if (!encrypted && !loopback) throw new Error("smtp: the server offers no TLS; refusing to send a lead in the clear");
    if (url.username) {
      const plain = Buffer.from(`\0${decodeURIComponent(url.username)}\0${decodeURIComponent(url.password)}`).toString("base64");
      say(`AUTH PLAIN ${plain}`);
      await expect(c => c === 235, "AUTH");
    }
    say(`MAIL FROM:<${mail.from}>`);
    await expect(c => c === 250, "MAIL FROM");
    say(`RCPT TO:<${mail.to}>`);
    await expect(c => c === 250 || c === 251, "RCPT TO");
    say("DATA");
    await expect(c => c === 354, "DATA");
    // Dot-stuffing: a line that starts with "." would otherwise end the data.
    say(`${message(mail).replace(/\r\n\./g, "\r\n..")}\r\n.`);
    await expect(c => c === 250, "message");
    done = true;
    say("QUIT");
  } finally {
    // After the message is accepted, the server closing on QUIT is expected.
    if (!done) for (const s of sockets) s.destroy();
    else socket.end();
  }
}
