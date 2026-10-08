// react-server-dom-webpack ships no types; these are the calls the RSC tests make.
declare module "react-server-dom-webpack/server.node" {
  import type { ReactNode } from "react";
  import type { Writable } from "node:stream";

  export function renderToPipeableStream(
    model: ReactNode,
    webpackMap: Record<string, unknown>,
    options?: { onError?: (error: unknown) => void },
  ): { pipe<T extends Writable>(destination: T): T; abort(reason?: unknown): void };

  /** What a bundler puts in place of a `"use client"` export on the server. */
  export function registerClientReference<T>(proxy: T, id: string, exportName: string): T;
}

declare module "react-server-dom-webpack/client.node" {
  import type { ReactNode } from "react";
  import type { Readable } from "node:stream";

  export function createFromNodeStream(
    stream: Readable,
    manifest: { moduleMap: Record<string, unknown>; serverModuleMap: null; moduleLoading: null },
  ): Promise<ReactNode>;
}
