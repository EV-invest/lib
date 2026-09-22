import { createContext, useContext, type ReactNode } from "react";

/**
 * A typed provider/hook pair for handing server-resolved copy to a client
 * status page.
 *
 * Next's `error.tsx` is the one status page that must be a Client Component,
 * so it cannot read the locale the way a server page does. The tempting fix —
 * `useParams()` plus the message catalogue — pulls every locale's catalogue
 * into the client graph. Instead the server layout resolves the handful of
 * strings the 500 needs and provides them above the error boundary (a
 * segment's `error.tsx` renders *inside* its layout, so this catches errors in
 * the page; an error in the layout itself is `global-error.tsx`'s problem).
 *
 * The hook returns `null` rather than throwing without a provider: an error
 * page that crashes because its copy is missing is a worse failure than one in
 * the fallback language, and it runs precisely when something already broke.
 *
 * @example
 * ```ts
 * export const { StatusCopyProvider, useStatusCopy } =
 *   createStatusCopy<{ title: string; retry: string }>();
 * ```
 */
export function createStatusCopy<T>() {
  const Context = createContext<T | null>(null);

  function StatusCopyProvider({ copy, children }: { copy: T; children: ReactNode }) {
    return <Context.Provider value={copy}>{children}</Context.Provider>;
  }

  function useStatusCopy(): T | null {
    return useContext(Context);
  }

  return { StatusCopyProvider, useStatusCopy };
}
