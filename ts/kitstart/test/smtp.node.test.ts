import { createServer, type AddressInfo, type Server, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { sendMail } from "../src/server/index";

let server: Server | undefined;
const open: Socket[] = [];
afterEach(
  () =>
    new Promise<void>(resolve => {
      for (const s of open.splice(0)) s.destroy();
      if (server) server.close(() => resolve());
      else resolve();
      server = undefined;
    }),
);

interface Script {
  rcpt?: string;
  /** Close the connection instead of answering `MAIL FROM`. */
  hangUpAtMail?: boolean;
  /** Accept the connection and never say a word. */
  silent?: boolean;
  /** Listen on every address, so a non-loopback spelling can reach it. */
  anyAddress?: boolean;
}

/** A scripted SMTP peer that records what it was told. */
function fakeSmtp(script: Script = {}): Promise<{ port: number; lines: string[] }> {
  const lines: string[] = [];
  server = createServer(socket => {
    open.push(socket);
    if (script.silent) return;
    let inData = false;
    let buffer = "";
    socket.write("220 fake ESMTP\r\n");
    socket.on("data", chunk => {
      buffer += chunk.toString("utf8");
      let end: number;
      while ((end = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        lines.push(line);
        if (inData) {
          if (line === ".") {
            inData = false;
            socket.write("250 queued\r\n");
          }
          continue;
        }
        if (line.startsWith("EHLO")) socket.write("250-fake\r\n250 AUTH PLAIN\r\n");
        else if (line.startsWith("AUTH PLAIN")) socket.write("235 ok\r\n");
        else if (line.startsWith("MAIL FROM")) {
          if (script.hangUpAtMail) socket.destroy();
          else socket.write("250 ok\r\n");
        } else if (line.startsWith("RCPT TO")) socket.write(script.rcpt ?? "250 ok\r\n");
        else if (line === "DATA") {
          inData = true;
          socket.write("354 go\r\n");
        } else if (line === "QUIT") socket.end("221 bye\r\n");
      }
    });
  });
  const host = script.anyAddress ? "::" : "127.0.0.1";
  return new Promise(resolve =>
    server!.listen(0, host, () => resolve({ port: (server!.address() as AddressInfo).port, lines })),
  );
}

const mail = { from: "leads@aquafix.top", to: "val@aquafix.top", subject: "Aquafix — nouvelle demande", text: "Demande #1" };
const OPTS = { helo: "aquafix.top" };

describe("the SMTP client", () => {
  it("delivers one message with auth, an encoded subject, a Message-ID and a base64 body", async () => {
    const { port, lines } = await fakeSmtp();
    await sendMail(`smtp://user:secret@127.0.0.1:${port}`, mail, OPTS);
    expect(lines).toContain(`AUTH PLAIN ${Buffer.from("\0user\0secret").toString("base64")}`);
    expect(lines).toContain("EHLO aquafix.top");
    expect(lines).toContain("RCPT TO:<val@aquafix.top>");
    expect(lines.some(l => l.startsWith("Subject: =?UTF-8?B?"))).toBe(true);
    expect(lines.some(l => /^Message-ID: <[0-9a-f-]+@aquafix\.top>$/.test(l))).toBe(true);
    expect(lines.some(l => l.startsWith("Date: "))).toBe(true);
    expect(lines).toContain(Buffer.from("Demande #1").toString("base64"));
  });

  it("fails loudly when the server refuses the recipient", async () => {
    const { port } = await fakeSmtp({ rcpt: "550 no such user\r\n" });
    await expect(sendMail(`smtp://127.0.0.1:${port}`, mail, OPTS)).rejects.toThrow(/RCPT TO refused/);
  });

  it("rejects, not hangs, when the server hangs up mid-conversation", async () => {
    const { port } = await fakeSmtp({ hangUpAtMail: true });
    await expect(sendMail(`smtp://127.0.0.1:${port}`, mail, { ...OPTS, timeoutMs: 5_000 })).rejects.toThrow(/closed/);
  });

  it("gives up on a server that accepts and says nothing", async () => {
    const { port } = await fakeSmtp({ silent: true });
    await expect(sendMail(`smtp://127.0.0.1:${port}`, mail, { ...OPTS, timeoutMs: 300 })).rejects.toThrow(/no answer within 300 ms/);
  });

  it("sends nothing in the clear to a server off loopback that offers no TLS", async () => {
    const { port, lines } = await fakeSmtp({ anyAddress: true });
    // Loopback reached through a spelling the client does not treat as loopback.
    await expect(sendMail(`smtp://[::ffff:127.0.0.1]:${port}`, mail, OPTS)).rejects.toThrow(/no TLS/);
    expect(lines.some(l => l.startsWith("MAIL FROM"))).toBe(false);
  });
});
