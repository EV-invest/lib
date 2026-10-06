"use client";

import { Badge, Button, cn } from "@evinvest/uikit";
import { useEffect, useRef, useState, type RefObject } from "react";
import { abAssignments, abReset, abVariantUrl, AB_FORCE_PARAM } from "../core/ab-switcher";
import type { AbSwitcherExperiment, AbSwitcherProps, AbSwitcherText } from "./ab-switcher-types";

const TEXT: AbSwitcherText = {
  title: "A/B test switcher",
  reset: "Reset",
  leave: "Leave test",
  minimize: "Minimize",
  hide: "Hide",
  unassigned: "not running",
};

/**
 * The QA menu itself, loaded only when `AbSwitcher` lets it: a chip in a
 * corner and, on a tap, each experiment's variants. A tap on a variant is the
 * brand's own force parameter — no other way in. Minimized and hidden live in
 * memory only: a reload brings the chip back. An experiment no cookie assigns
 * is off: the proxy assigns every running one on the page the menu mounts on,
 * and would refuse a force for it, so its variants are disabled.
 */
export function AbSwitcherPanel({ experiments, qaCookie, current, forceParam = AB_FORCE_PARAM, className, text }: AbSwitcherProps) {
  const t = { ...TEXT, ...text };
  const keys = experiments.map(e => e.key);
  const [assigned] = useState(() => current ?? abAssignments(document.cookie, keys));
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [hidden, setHidden] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLButtonElement>(null);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) chip.current?.focus();
  };
  useDismiss(open, root, close);
  const reset = (mode: "reassign" | "leave") => {
    const plan = abReset(location.href, keys, qaCookie, mode, forceParam);
    for (const c of plan.cookies) document.cookie = c;
    location.replace(plan.url);
  };

  // The first choice a tap can take gets the focus; with none, the reset.
  const live = experiments.findIndex(e => assigned[e.key] !== undefined);
  if (hidden) return null;
  return (
    <div data-ab-switcher="" ref={root} className={cn("fixed right-4 bottom-4 z-40", className)}>
      {open && (
        <div role="dialog" aria-label={t.title} className="absolute right-0 bottom-full mb-2 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-4 rounded-md border border-border bg-popover p-3 text-ink shadow-md">
          {experiments.map((e, i) => (
            <ExperimentRow key={e.key} experiment={e} value={assigned[e.key]} unassigned={t.unassigned} autoFocus={i === live} onPick={v => location.assign(abVariantUrl(location.href, e.key, v, forceParam))} />
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="touch" autoFocus={live < 0} className="flex-1" onClick={() => reset("reassign")}>{t.reset}</Button>
            <Button variant="outline" size="touch" className="flex-1" onClick={() => reset("leave")}>{t.leave}</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="touch" className="flex-1" onClick={() => { setMinimized(true); close(true); }}>{t.minimize}</Button>
            <Button variant="ghost" size="touch" className="flex-1" onClick={() => setHidden(true)}>{t.hide}</Button>
          </div>
        </div>
      )}
      <Button ref={chip} variant="secondary" size="touch" icon={minimized} aria-label={t.title} aria-expanded={open} className={cn("shadow-md", !minimized && "gap-1.5 px-3")} onClick={() => { if (open) close(false); else { setOpen(true); setMinimized(false); } }}>
        <span className="font-semibold">A/B</span>
        {!minimized && keys.map(k => <Badge key={k} variant="outline" className="border-current/40 text-current">{assigned[k] ?? "–"}</Badge>)}
      </Button>
    </div>
  );
}

/**
 * Escape closes and gives the focus back to the chip; a tap outside closes.
 * Not the kit's `Popover`: sharing its primitives with the page makes
 * Turbopack re-split the page's chunks, ~400 B gz on every visitor's first
 * load for a menu almost nobody opens. The panel is not portaled — the chip's
 * fixed corner is its anchor — so the root holds both.
 */
function useDismiss(open: boolean, root: RefObject<HTMLDivElement | null>, close: (refocus: boolean) => void) {
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && close(true);
    const down = (e: PointerEvent) => !(e.target instanceof Node && root.current?.contains(e.target)) && close(false);
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", down, true);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", down, true);
    };
  }, [open, root, close]);
}

interface ExperimentRowProps {
  experiment: AbSwitcherExperiment;
  value: string | undefined;
  unassigned: string;
  autoFocus: boolean;
  onPick: (value: string) => void;
}

function ExperimentRow({ experiment: e, value, unassigned, autoFocus, onPick }: ExperimentRowProps) {
  const labelId = `ab-switcher-${e.key}`;
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span id={labelId} className="font-medium text-ink">{e.label ?? e.key}</span>
        {value === undefined && <span className="text-xs text-ink-soft">{unassigned}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {/* The panel opens on a tap; its first choice takes the focus, so Escape and Tab start inside it. */}
        {e.variants.map((v, i) => {
          const on = v.value === value;
          return (
            <Button key={v.value} variant={on ? "primary" : "outline"} size="touch" aria-pressed={on} disabled={value === undefined} autoFocus={autoFocus && i === 0} className="flex-1" onClick={() => onPick(v.value)}>
              {v.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
