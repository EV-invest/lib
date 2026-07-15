import * as React from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children into `container` (default `document.body`) via
 * `react-dom`'s `createPortal` — the dep-light stand-in for
 * `@radix-ui/react-portal`. SSR-safe: renders nothing until mounted.
 *
 * Rust has no portal counterpart (see the README "Limitations"): `ev_lib::uikit`
 * overlays render inline with fixed positioning instead.
 */
export interface PortalProps {
  children: React.ReactNode;
  container?: Element | null;
}

export function Portal({ children, container }: PortalProps) {
  // Render the portal synchronously on the client so a consumer's ref (e.g. a
  // floating element measured in `useLayoutEffect`) is attached in the same
  // commit. Overlays only render this when open — i.e. after a client event —
  // so there is no server render to mismatch.
  if (typeof document === "undefined") return null;
  const target = container ?? document.body;
  return createPortal(children, target);
}
