import * as React from "react";
import { Writable } from "node:stream";
import { renderToPipeableStream } from "react-server-dom-webpack/server.node";
import { describe, expect, it } from "vitest";

import { AppShell } from "../../src/components/app-shell";
import { NavBadge } from "../../src/components/nav-badge";
import { PageFrame } from "../../src/components/page-frame";

// The shell's layout half carries no "use client": a Next layout renders it on
// the server and passes the client nav in as a slot.
function flight(node: React.ReactNode): Promise<{ payload: string; errors: string[] }> {
  return new Promise(resolve => {
    let payload = "";
    const errors: string[] = [];
    const stream = renderToPipeableStream(node, {}, { onError: e => void errors.push(String((e as Error).message)) });
    stream.pipe(
      new Writable({
        write(chunk, _enc, done) {
          payload += chunk;
          done();
        },
        final(done) {
          resolve({ payload, errors });
          done();
        },
      }),
    );
  });
}

describe("the app shell's layout renders in a React Server Component", () => {
  it("AppShell + PageFrame + NavBadge", async () => {
    const { payload, errors } = await flight(
      <AppShell rail={<aside>rail</aside>} banner={<NavBadge count={120} />}>
        <PageFrame title="Home">
          <section>one</section>
        </PageFrame>
      </AppShell>,
    );
    expect(errors).toEqual([]);
    expect(payload).toContain('"data-enter":"stagger"');
    expect(payload).toContain("99+");
  });
});
