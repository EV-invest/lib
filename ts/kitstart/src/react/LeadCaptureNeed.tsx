"use client";

import { Button, cn, Field, FieldLabel } from "@evinvest/uikit";
import type { ReactNode } from "react";
import { FormSelect, type FormSelectOption } from "./FormSelect";
import { TileGroupPart } from "./lead-parts";
import type { PartClassNames } from "./parts";

/**
 * `single`: one screen. `steps`: one question per screen. `qualify-first`:
 * the two-screen form `steps` grew from — the need, then everything else —
 * kept as it was for the sites that run it.
 */
export type LeadCaptureLayout = "single" | "steps" | "qualify-first";

/** How the need is asked: the kit's select, a tile per need, or a card per need with the brand's icon. */
export type LeadNeedDisplay = "select" | "tiles" | "cards";

/** A need as the form offers it; `icon` is drawn on its card (`needDisplay="cards"`), the brand's own. */
export interface LeadNeedOption extends FormSelectOption {
  icon?: ReactNode;
  /** On a tile or card, on a phone (under `sm`): a shorter label; the select and assistive technology keep `label`. */
  shortLabel?: string | undefined;
}

type NeedPart = "field" | "label" | "control" | "need" | "needs" | "summary" | "icon";

/** The need's tiles or cards: a list, or a grid of cards with an icon each. */
export const needGrid = (display: LeadNeedDisplay) => (display === "cards" ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "grid grid-cols-1 gap-2 sm:grid-cols-2");
export const needTile = (display: LeadNeedDisplay) => (display === "cards" ? "h-full flex-col justify-center gap-2 px-3 py-4 text-center" : "px-4 py-3");

export interface NeedFieldProps {
  /** The select on one screen by default, tiles on two. */
  display: LeadNeedDisplay;
  name: string;
  needs: readonly LeadNeedOption[];
  need: string | undefined;
  /** Showing the choice again after it was made for the visitor. */
  editing: boolean;
  hydrated: boolean;
  label: string;
  changeLabel: string;
  /** Blocks the submit while no tile is chosen, in the page's words. */
  requiredText: string;
  /** Enter on a tile answers it rather than submitting the form. */
  enterPicks: boolean;
  /** The visitor's answer: a tap, Enter or Space — `qualify-first` moves on. */
  onPick: (need: string, from: HTMLElement | null) => void;
  /** An arrow key moved the choice: chosen, but the visitor is still choosing. */
  onSelect: (need: string) => void;
  onEdit: () => void;
  classNames?: PartClassNames<NeedPart> | undefined;
}

/**
 * What the job is. A need already known — from the page, `?need=` or the card
 * tapped — is not asked again: it is a line with its label and, once the
 * script runs, a way to change it. Otherwise `single` asks with the kit's
 * select (first need by default, as before) and `qualify-first` with a tile
 * per need: one tap answers it. `display` may ask either with tiles, or with
 * cards that carry the brand's icon.
 */
export function NeedField(props: NeedFieldProps) {
  const { display, name, needs, need, editing, hydrated, label, changeLabel, onPick, onSelect, onEdit, classNames: c } = props;
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
  if (display === "select") {
    return (
      <Field className={cn("flex flex-col gap-2", c?.field)}>
        <FieldLabel className={c?.label}>{label}</FieldLabel>
        <FormSelect name={name} size="lg" defaultValue={need ?? needs[0]?.value} options={needs} onValueChange={v => onPick(v, null)} classNames={c?.control ? { trigger: c.control } : undefined} />
      </Field>
    );
  }
  return (
    <TileGroupPart.Part
      name={name}
      legend={label}
      options={needs.map(n => ({ value: n.value, label: n.label, shortLabel: n.shortLabel, ...(display === "cards" && n.icon !== undefined ? { icon: n.icon } : {}) }))}
      value={need}
      required
      requiredText={props.requiredText}
      field="need"
      marker="data-need-option"
      enterPicks={props.enterPicks}
      onPick={onPick}
      onSelect={onSelect}
      classNames={{ field: c?.field, legend: c?.label, grid: cn(needGrid(display), c?.needs), tile: cn(needTile(display), c?.need), icon: c?.icon }}
    />
  );
}
