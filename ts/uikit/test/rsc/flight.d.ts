// react-server-dom-webpack ships no types; this is the one call the RSC test makes.
declare module "react-server-dom-webpack/server.node" {
  import type { ReactNode } from "react";
  import type { Writable } from "node:stream";

  export function renderToPipeableStream(
    model: ReactNode,
    webpackMap: Record<string, unknown>,
    options?: { onError?: (error: unknown) => void },
  ): { pipe<T extends Writable>(destination: T): T; abort(reason?: unknown): void };
}
