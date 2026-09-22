import * as React from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children into `container` (default: the nearest
 * {@link PortalProvider}'s, else `document.body`) via `react-dom`'s
 * `createPortal` — the dep-light stand-in for `@radix-ui/react-portal`.
 * SSR-safe: renders nothing until mounted.
 *
 * Rust has no portal counterpart (see the README "Limitations"): `ev_lib::uikit`
 * overlays render inline with fixed positioning instead.
 */
export interface PortalProps {
  children: React.ReactNode;
  container?: Element | null;
}

const PortalContext = React.createContext<Element | null>(null);

export interface PortalProviderProps {
  /** Where every overlay beneath this provider mounts; `null` falls back to `document.body`. */
  container: Element | null;
  children?: React.ReactNode;
}

/**
 * Re-targets every overlay beneath it (Dialog, Select, Popover, Tooltip, …)
 * into `container`. Tokens are inherited custom properties, so an overlay
 * portaled to `document.body` leaves its `[data-brand]` scope and paints in
 * the root palette; mounted inside the scope, it keeps the brand's.
 */
export function PortalProvider({ container, children }: PortalProviderProps) {
  return <PortalContext.Provider value={container}>{children}</PortalContext.Provider>;
}

export function Portal({ children, container }: PortalProps) {
  const provided = React.useContext(PortalContext);
  // Render the portal synchronously on the client so a consumer's ref (e.g. a
  // floating element measured in `useLayoutEffect`) is attached in the same
  // commit. Overlays only render this when open — i.e. after a client event —
  // so there is no server render to mismatch.
  if (typeof document === "undefined") return null;
  const target = container ?? provided ?? document.body;
  return createPortal(children, target);
}
