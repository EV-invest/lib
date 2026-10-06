"use client";

import { useEffect, useState, type ComponentType } from "react";
import { abSwitcherVisible } from "../core/ab-gate";
import type { AbSwitcherProps } from "./ab-switcher-types";

/**
 * The QA menu's gate: everything a visitor downloads for it. On the server and
 * on the first client render it is nothing — the page stays static, no cookie
 * is read there — and after mount it loads the panel only outside production
 * or for a visit carrying the QA cookie. Nothing heavy is imported here: the
 * panel and the kit come with the dynamic import, in their own chunk.
 */
export function AbSwitcher(props: AbSwitcherProps) {
  const [Panel, setPanel] = useState<ComponentType<AbSwitcherProps> | null>(null);
  const { qaCookie } = props;

  useEffect(() => {
    if (!abSwitcherVisible(document.cookie, qaCookie, process.env.NODE_ENV)) return;
    // An answer after unmount is dropped by React; no flag to carry.
    void import("./AbSwitcherPanel").then(m => setPanel(() => m.AbSwitcherPanel));
  }, [qaCookie]);

  return Panel ? <Panel {...props} /> : null;
}
