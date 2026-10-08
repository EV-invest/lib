"use client";

import { lazy, Suspense, useState, useSyncExternalStore, type ComponentType } from "react";

/** A piece of a client island in a chunk of its own, and the way to ask for that chunk early. */
export interface LazyPart<P extends object> {
  /** Drawn where the piece goes; see {@link lazyPart}. */
  Part: ComponentType<P>;
  /** Asks for the chunk — once a page; later calls share the first. */
  preload: () => void;
  /** Whether the chunk is here, for `useSyncExternalStore` with {@link LazyPart.subscribe}. */
  isLoaded: () => boolean;
  subscribe: (onLoad: () => void) => () => void;
}

const noop = () => () => undefined;

/** Every part's loader, for {@link loadLazyParts}. */
const LOADERS: (() => Promise<unknown>)[] = [];

/**
 * Resolves once every lazily drawn part of the kit is loaded — for a test
 * that renders a card and reads it at once (`beforeAll(loadLazyParts)`). A
 * page never needs it: the server loads them as their modules load, and a
 * browser fetches what its card draws.
 */
export function loadLazyParts(): Promise<void> {
  return Promise.all(LOADERS.map(load => load())).then(() => undefined);
}

/**
 * A component a page pays for only when it draws it — the shape of the
 * `messenger` variants (`LeadCaptureMessenger`), for any piece of an island.
 *
 * On the server every part is loaded as its module is, so a render finds it
 * and writes it into the page whole: no boundary of its own, which React
 * would reveal late. Hydrating, a part whose chunk is still on its way holds
 * the island's hydration — the server's markup stays as it is, no fallback
 * drawn — and `preload` from the island's render starts every chunk it will
 * need at once, so none waits behind another. A part first drawn after
 * hydration (a later step, the success) waits behind a boundary of its own,
 * drawing nothing until its chunk is here.
 */
export function lazyPart<P extends object>(load: () => Promise<ComponentType<P>>): LazyPart<P> {
  let loaded: ComponentType<P> | null = null;
  let loading: Promise<ComponentType<P>> | null = null;
  const listeners = new Set<() => void>();
  const fetchPart = (): Promise<ComponentType<P>> => {
    loading ??= load().then(
      part => {
        loaded = part;
        for (const listener of listeners) listener();
        return part;
      },
      (error: unknown) => {
        // A chunk that failed may be asked for again: the next draw retries.
        loading = null;
        throw error;
      },
    );
    return loading;
  };
  const preload = () => void fetchPart().catch(() => undefined);
  LOADERS.push(fetchPart);
  if (typeof window === "undefined") preload();
  const Lazy = lazy(() => fetchPart().then(part => ({ default: part })));

  function Part(props: P) {
    const hydrating = useSyncExternalStore(noop, () => false, () => true);
    // Chosen on the first render and kept: a structure swapped under the part would draw it anew.
    const [Loaded] = useState(() => loaded);
    const [wrapped] = useState(() => !hydrating);
    if (Loaded) return <Loaded {...props} />;
    return wrapped ? (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    ) : (
      <Lazy {...props} />
    );
  }
  const subscribe = (onLoad: () => void) => {
    listeners.add(onLoad);
    return () => void listeners.delete(onLoad);
  };
  return { Part, preload, isLoaded: () => loaded !== null, subscribe };
}
