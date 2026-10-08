import { fileURLToPath } from "node:url";
import type * as ReactModule from "react";
import type { ReactElement } from "react";
import type * as ClientModule from "react-dom/client";
import type * as ServerModule from "react-dom/server";
import { afterEach, vi } from "vitest";
import type * as KitModule from "../../src/react/index";

/**
 * The kit as a page gets it before its chunks land — for `*.cold.test.tsx`.
 *
 * A lazily drawn part keeps its chunk once a page has it, for the module's
 * life; each test therefore takes a fresh copy of the kit and of React with
 * it (one React per copy, or hooks break), and each chunk the kit fetches
 * apart is replaced by one that records it was asked for and lands only
 * when the test lets it.
 */

/** The modules the kit fetches as chunks of their own: `FormSelect`'s scripted list. */
export const CHUNKS = ["FormSelectKit"] as const;
export type ChunkName = (typeof CHUNKS)[number];

export interface Chunk {
  /** A page asked for it — a fetch started. */
  asked: boolean;
  /** Lets a held chunk land. */
  release: () => void;
  readonly landing: Promise<void>;
}

/** A chunk that lands only on `release()`. */
export function heldChunk(): Chunk {
  let release = () => {};
  const landing = new Promise<void>(resolve => (release = resolve));
  return { asked: false, release, landing };
}

const openChunk = (): Chunk => ({ asked: false, release: () => {}, landing: Promise.resolve() });

const modulePath = (name: ChunkName) => fileURLToPath(new URL(`../../src/react/${name}.tsx`, import.meta.url));

/** A copy of the kit and the React it renders with, and the chunks it fetches. */
export interface FreshKit {
  React: typeof ReactModule;
  client: typeof ClientModule;
  server: typeof ServerModule;
  kit: typeof KitModule;
  chunks: Record<ChunkName, Chunk>;
}

/** A fresh kit with its own React; `held` chunks wait for their release, the rest land as asked. */
export async function freshKit(held: Partial<Record<ChunkName, Chunk>> = {}): Promise<FreshKit> {
  vi.resetModules();
  // `fromEntries` types its keys as `string`; they are `CHUNKS`, each once.
  const chunks = Object.fromEntries(CHUNKS.map(name => [name, held[name] ?? openChunk()])) as Record<ChunkName, Chunk>;
  for (const name of CHUNKS) {
    const chunk = chunks[name];
    vi.doMock(modulePath(name), async (original: () => Promise<unknown>) => {
      chunk.asked = true;
      await chunk.landing;
      return original();
    });
  }
  const [React, client, server, kit] = await Promise.all([import("react"), import("react-dom/client"), import("react-dom/server"), import("../../src/react/index")]);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  return { React, client, server, kit, chunks };
}

/** The server's page for `node`, from a kit with every chunk here — what the browser is sent. */
export async function serverHtml(node: (k: FreshKit) => ReactElement): Promise<string> {
  const k = await freshKit();
  await k.kit.loadLazyParts();
  return k.server.renderToString(node(k));
}

const mounted: { unmount: () => void; container: HTMLElement }[] = [];
afterEach(() => {
  for (const m of mounted.splice(0)) {
    m.unmount();
    m.container.remove();
  }
});

/** What a page shows after the script ran, and the errors React reported while hydrating. */
export interface Mounted {
  container: HTMLElement;
  recoverable: unknown[];
  rerender: (node: ReactElement) => Promise<void>;
}

/** `html` in the document as the server sent it, then `k`'s React hydrating `node` over it. */
export async function hydrate(k: FreshKit, html: string, node: ReactElement): Promise<Mounted> {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const recoverable: unknown[] = [];
  const root = await k.React.act(async () => k.client.hydrateRoot(container, node, { onRecoverableError: error => void recoverable.push(error) }));
  mounted.push({ unmount: () => k.React.act(() => root.unmount()), container });
  return { container, recoverable, rerender: next => k.React.act(async () => root.render(next)) };
}

/** `node` rendered by `k`'s React into an empty container — a client render, no server markup. */
export async function mount(k: FreshKit, node: ReactElement): Promise<Mounted> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = k.client.createRoot(container);
  await k.React.act(async () => root.render(node));
  mounted.push({ unmount: () => k.React.act(() => root.unmount()), container });
  return { container, recoverable: [], rerender: next => k.React.act(async () => root.render(next)) };
}

/** Lets every held chunk land and waits, in `k`'s `act`, until every part is here. */
export async function landAll(k: FreshKit): Promise<void> {
  for (const name of CHUNKS) k.chunks[name].release();
  await k.React.act(async () => {
    await k.kit.loadLazyParts();
  });
}
