import * as React from "react";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { Writable } from "node:stream";
import { registerClientReference, renderToPipeableStream } from "react-server-dom-webpack/server.node";
import { describe, expect, it } from "vitest";

import type * as FieldModule from "../../src/components/field";
import type * as InputModule from "../../src/components/input";

// A Server Component page that writes `<Field><FieldLabel/><Input/></Field>`
// never runs those modules: they say "use client", so the bundler hands the
// server a reference to each, and the browser resolves the reference to the
// real component. `FieldLabel` then decides on `for` by looking at element
// types it did not create — the payload's. This renders that path end to end:
// Flight on the server here, SSR + hydration in a client process.
const PKG = join(import.meta.dirname, "../..");
const CLIENT = join(import.meta.dirname, "hydrate-flight.client.tsx");
const VITE_NODE = createRequire(import.meta.url).resolve("vite-node/vite-node.mjs");

function reference<T>(module: string, name: string): T {
  const proxy = () => {
    throw new Error(`${module}#${name} is a client component; the server only refers to it`);
  };
  return registerClientReference(proxy, module, name) as T;
}

const Field = reference<typeof FieldModule.Field>("field", "Field");
const FieldLabel = reference<typeof FieldModule.FieldLabel>("field", "FieldLabel");
const Input = reference<typeof InputModule.Input>("input", "Input");

const manifest = Object.fromEntries(
  ["field#Field", "field#FieldLabel", "input#Input"].map(ref => {
    const [id, name] = ref.split("#");
    return [ref, { id, chunks: [], name }];
  }),
);

function flight(node: React.ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    let payload = "";
    const stream = renderToPipeableStream(node, manifest, { onError: reject });
    stream.pipe(
      new Writable({
        write(chunk, _enc, done) {
          payload += chunk;
          done();
        },
        final(done) {
          resolve(payload);
          done();
        },
      }),
    );
  });
}

interface Hydrated {
  labelFor: string | null;
  controlId: string | null;
  labelText: string | null;
  recoverable: string[];
}

function isHydrated(value: unknown): value is Hydrated {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return "labelFor" in v && "controlId" in v && "labelText" in v && Array.isArray(v["recoverable"]);
}

// The client half runs without the react-server condition this project sets.
function hydrate(payload: string): Promise<Hydrated> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [VITE_NODE, CLIENT], {
      cwd: PKG,
      env: { ...process.env, NODE_OPTIONS: "", FLIGHT_PAYLOAD: payload },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", chunk => (out += chunk));
    child.stderr.on("data", chunk => (err += chunk));
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) return reject(new Error(`client process exited ${code}:\n${err}`));
      let result: unknown;
      try {
        result = JSON.parse(out);
      } catch {
        return reject(new Error(`client process printed no result:\n${out}\n${err}`));
      }
      if (!isHydrated(result)) return reject(new Error(`unexpected client output: ${out}`));
      resolve(result);
    });
  });
}

function SignUp() {
  return (
    <Field>
      <FieldLabel>Email</FieldLabel>
      <Input type="email" />
    </Field>
  );
}

describe("Field rendered from a Server Component", () => {
  it("labels its Input after hydration, by the id Field minted on the client", async () => {
    const result = await hydrate(await flight(<SignUp />));
    expect(result.recoverable).toEqual([]);
    expect(result.labelText).toBe("Email");
    expect(result.controlId).not.toBeNull();
    expect(result.labelFor).toBe(result.controlId);
  }, 30_000);
});
