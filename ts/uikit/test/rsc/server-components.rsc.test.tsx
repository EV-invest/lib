import * as React from "react";
import { Writable } from "node:stream";
import { renderToPipeableStream } from "react-server-dom-webpack/server.node";
import { describe, expect, it } from "vitest";

import { Badge } from "../../src/components/badge";
import { BreadcrumbLink } from "../../src/components/breadcrumb";
import { Button } from "../../src/components/button";
import { ButtonGroupText } from "../../src/components/button-group";
import { Item } from "../../src/components/item";

// Runs under the `react-server` condition (see vitest.workspace.ts), the way
// a Next Server Component renders: these modules carry no "use client", so
// whatever they return must survive the Flight serializer. A function ref in
// the output does not — `<Button asChild><a/></Button>` failed with "Refs
// cannot be used in Server Components" until `Slot` stopped adding one it did
// not need.
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

const link = <a href="/team">go</a>;

describe("server components with asChild render in a React Server Component", () => {
  it.each([
    ["Button", <Button asChild>{link}</Button>],
    ["Badge", <Badge asChild>{link}</Badge>],
    ["BreadcrumbLink", <BreadcrumbLink asChild>{link}</BreadcrumbLink>],
    ["ButtonGroupText", <ButtonGroupText asChild>{link}</ButtonGroupText>],
    ["Item", <Item asChild>{link}</Item>],
  ])("%s", async (_name, node) => {
    const { payload, errors } = await flight(node);
    expect(errors).toEqual([]);
    expect(payload).toContain('"href":"/team"');
  });

  it("still fails loudly for a ref the caller really passed — that one needs a client component", async () => {
    const { errors } = await flight(<Button asChild ref={() => undefined}>{link}</Button>);
    expect(errors.join()).toMatch(/[Rr]efs? cannot be used|Functions cannot be passed/);
  });
});
