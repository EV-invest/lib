"use client";

import { Button, cn, Field, FieldLabel } from "@evinvest/uikit";
import { FormSelect, type FormSelectOption } from "./FormSelect";
import type { PartClassNames } from "./parts";

export type LeadCaptureLayout = "single" | "qualify-first";

type NeedPart = "field" | "label" | "control" | "need" | "needs" | "summary";

export interface NeedFieldProps {
  layout: LeadCaptureLayout;
  name: string;
  needs: readonly FormSelectOption[];
  need: string | undefined;
  /** Showing the choice again after it was made for the visitor. */
  editing: boolean;
  hydrated: boolean;
  label: string;
  changeLabel: string;
  onPick: (need: string) => void;
  onEdit: () => void;
  classNames?: PartClassNames<NeedPart> | undefined;
}

/**
 * What the job is. A need already known — from the page, `?need=` or the card
 * tapped — is not asked again: it is a line with its label and, once the
 * script runs, a way to change it. Otherwise `single` asks with the kit's
 * select (first need by default, as before) and `qualify-first` with a tile
 * per need: one tap answers it.
 */
export function NeedField(props: NeedFieldProps) {
  const { layout, name, needs, need, editing, hydrated, label, changeLabel, onPick, onEdit, classNames: c } = props;
  const chosen = needs.find(n => n.value === need);
  if (chosen && !editing) {
    return (
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-ink", c?.summary)}>
        <input type="hidden" name={name} value={chosen.value} />
        <span className="text-sm text-ink-soft">{label}</span>
        <span className="font-medium">{chosen.label}</span>
        {hydrated && (
          <Button type="button" variant="link" size="touch" className="px-1" onClick={onEdit}>
            {changeLabel}
          </Button>
        )}
      </div>
    );
  }
  if (layout === "single") {
    return (
      <Field className={cn("flex flex-col gap-2", c?.field)}>
        <FieldLabel className={c?.label}>{label}</FieldLabel>
        <FormSelect name={name} size="lg" defaultValue={need ?? needs[0]?.value} options={needs} onValueChange={onPick} classNames={c?.control ? { trigger: c.control } : undefined} />
      </Field>
    );
  }
  return (
    <fieldset className={cn("flex flex-col gap-2", c?.field)}>
      <legend className={cn("mb-2 text-sm font-medium text-ink", c?.label)}>{label}</legend>
      <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", c?.needs)}>
        {needs.map(n => (
          <label key={n.value} className="relative block cursor-pointer">
            <input
              type="radio"
              name={name}
              value={n.value}
              required
              checked={need === n.value}
              onChange={() => onPick(n.value)}
              className="peer absolute inset-0 opacity-0"
              data-need-option=""
              data-lead-field="need"
            />
            <span
              className={cn(
                "flex min-h-11 items-center rounded-[var(--control-radius)] border border-input px-4 py-3 text-ink transition-colors",
                "peer-checked:border-primary peer-checked:bg-hover peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50",
                c?.need,
              )}
            >
              {n.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
