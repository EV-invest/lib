"use client";

import { cn } from "@evinvest/uikit";
import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

/** One answer as a tile: its words, and what a brand or the price adds to them. */
export interface TileOption {
  value: string;
  label: string;
  /** Drawn instead of `label` on a phone (under `sm`); the radio is still named by the whole `label`. */
  shortLabel?: string | undefined;
  /** Two columns of the grid (an "I don't know" under a row of answers). */
  span?: 2 | undefined;
  /** More classes for this tile alone, after the group's. */
  className?: string | undefined;
  /** Above the label, the brand's (a need's icon). */
  icon?: ReactNode;
  /** A short tag beside the label ("Le plus choisi"). */
  badge?: string | undefined;
  /** At the end of the tile: what this answer would cost. */
  aside?: string | null | undefined;
}

export interface TileGroupProps {
  name: string;
  legend: string;
  options: readonly TileOption[];
  value: string | undefined;
  required: boolean;
  /** Blocks the submit while nothing is chosen, in the page's words; none → the browser's own. */
  requiredText?: string | undefined;
  /** `data-lead-field` on each radio: the role events and the focus read. */
  field: string;
  /** A bare attribute on each radio, for a selector of the caller's (`data-need-option`). */
  marker?: string | undefined;
  /** Enter on a tile answers it, instead of submitting a form half filled. Off: Enter is the form's. */
  enterPicks: boolean;
  /** The visitor's answer — a tap, Enter or Space — with the radio it came from. */
  onPick: (value: string, radio: HTMLInputElement) => void;
  /** An arrow key moved the choice: chosen, but the visitor is still choosing. */
  onSelect: (value: string) => void;
  classNames: { field?: string | undefined; legend?: string | undefined; grid?: string | undefined; tile?: string | undefined; icon?: string | undefined; badge?: string | undefined; aside?: string | undefined };
}

/**
 * A question answered by a tap: touch-sized native radios, so the answer
 * posts without a script, over a tile the brand dresses. A radio group
 * answers arrows with a click (`detail` 0) and a change, the same events a
 * tap makes: what moves on is told apart by its key or pointer.
 */
export function TileGroup(props: TileGroupProps) {
  const { name, legend, options, value, required, field, marker, enterPicks, onPick, onSelect, classNames: c } = props;
  const group = useRef<HTMLFieldSetElement>(null);
  const pointer = useRef(false);
  const answered = useRef(false);
  const requiredText = props.requiredText;
  useEffect(() => {
    if (requiredText === undefined) return;
    for (const radio of group.current?.querySelectorAll<HTMLInputElement>("input[type=radio]") ?? []) radio.setCustomValidity(value === undefined ? requiredText : "");
  });
  const markerProps = marker ? { [marker]: "" } : {};
  return (
    <fieldset ref={group} className={cn("flex flex-col gap-2", c.field)}>
      <legend className={cn("mb-2 text-sm font-medium text-ink", c.legend)}>{legend}</legend>
      <div className={c.grid}>
        {options.map(o => (
          <label key={o.value} className={cn("relative block cursor-pointer", o.span === 2 && "col-span-2")}>
            <input
              type="radio"
              name={name}
              value={o.value}
              required={required}
              checked={value === o.value}
              onPointerDown={() => {
                pointer.current = true;
              }}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                pointer.current = false;
                answered.current = false;
                if (e.key !== "Enter" || !enterPicks) return;
                e.preventDefault();
                answered.current = true;
                onPick(o.value, e.currentTarget);
              }}
              onKeyUp={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key !== " ") return;
                answered.current = true;
                onPick(o.value, e.currentTarget);
              }}
              onClick={(e: MouseEvent<HTMLInputElement>) => {
                if (e.detail === 0 && !pointer.current) return;
                pointer.current = false;
                answered.current = true;
                onPick(o.value, e.currentTarget);
              }}
              onChange={() => {
                if (!answered.current) onSelect(o.value);
                answered.current = false;
              }}
              className="peer absolute inset-0 opacity-0"
              data-lead-field={field}
              aria-label={o.shortLabel !== undefined ? [o.label, o.badge, o.aside].filter(Boolean).join(", ") : undefined}
              {...markerProps}
            />
            <span
              className={cn(
                "flex min-h-11 items-center rounded-[var(--control-radius)] border border-input text-ink transition-colors",
                "peer-checked:border-primary peer-checked:bg-hover peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50",
                c.tile,
                o.className,
              )}
            >
              {o.icon !== undefined && (
                <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center [&_svg]:size-6", c.icon)}>
                  {o.icon}
                </span>
              )}
              {o.shortLabel !== undefined ? (
                <>
                  <span aria-hidden="true" className="min-w-0 sm:hidden">
                    {o.shortLabel}
                  </span>
                  <span className="min-w-0 max-sm:hidden">{o.label}</span>
                </>
              ) : (
                <span className="min-w-0">{o.label}</span>
              )}
              {o.badge && <span className={cn("rounded-full bg-hover px-2 py-0.5 text-xs font-medium text-ink", c.badge)}>{o.badge}</span>}
              {o.aside && <span className={cn("ms-auto shrink-0 font-medium tabular-nums", c.aside)}>{o.aside}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
