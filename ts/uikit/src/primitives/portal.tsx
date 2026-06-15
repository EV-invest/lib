import * as React from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children into `container` (default `document.body`) via
 * `react-dom`'s `createPortal` — the dep-light stand-in for
 * `@radix-ui/react-portal`. SSR-safe: renders nothing until mounted.
 *
 * Rust has no portal counterpart (see the README "Limitations"): `ev::uikit`
 * overlays render inline with fixed positioning instead.
 */
export interface PortalProps {
  children: React.ReactNode;
  container?: Element | null;
}

export function Portal({ children, container }: PortalProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const target = container ?? document.body;
  return createPortal(children, target);
}
