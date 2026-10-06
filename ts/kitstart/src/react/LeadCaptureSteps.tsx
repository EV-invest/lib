"use client";

import { Button, cn, Progress } from "@evinvest/uikit";
import { Fragment, type ReactNode } from "react";
import { fillText } from "../core/lead-capture-format";
import type { LeadIntro, StepId } from "./lead-steps";
import { TileGroup } from "./LeadCaptureTiles";
import type { PartClassNames } from "./parts";

export type StepsPart = "progress" | "stepBack" | "step" | "answers" | "answer" | "intro" | "introOption" | "icon" | "label";

/** One screen: what it asks (the chip's label), what was answered (`null` while open), and the screen. */
export interface StepView {
  id: StepId;
  label: string;
  value: string | null;
  node: ReactNode;
}

/**
 * Without a script every screen is there at once — the form posts as one —
 * and the bar, the back link and the chips, which need one, are not.
 * Unscoped on purpose: the attributes are the steps' own. A screen off is
 * hidden by an inline style, not the `hidden` attribute: Tailwind's preflight
 * hides `[hidden]` with `!important` in a layer, which no unlayered rule
 * overrides, and an inline style yields to this one.
 */
const NO_SCRIPT = "<style>[data-lead-step]{display:flex!important}[data-lead-chrome]{display:none!important}</style>";

/** The mark of a screen that is off, for a selector of the focus's. */
export const STEP_OFF = "data-lead-off";
const OFF = { display: "none" } as const;

/**
 * `layout="steps"`: one question per screen. Over it a thin bar (the screen,
 * read out as `stepProgress`), the way back, and the screens already
 * answered as chips — each a tap back to it. Every screen stays in the form,
 * hidden but posted, so what was answered three screens ago still goes with
 * the lead.
 */
export function LeadSteps(props: {
  steps: readonly StepView[];
  current: StepId;
  /**
   * How many screens the bar counts: at least those known, more while an
   * answer to come may add some — so it only ever moves forward as the
   * visitor answers. `null`: not said yet (the intro decides the branch).
   */
  total: number | null;
  onBack: () => void;
  onEdit: (id: StepId) => void;
  text: { stepProgress: string; stepProgressOpen: string; stepBack: string; change: string };
  classNames?: PartClassNames<StepsPart> | undefined;
}) {
  const { steps, current, text, classNames: c } = props;
  const index = Math.max(0, steps.findIndex(s => s.id === current));
  const n = String(index + 1);
  const progress = props.total === null ? fillText(text.stepProgressOpen, { n }) : fillText(text.stepProgress, { n, total: String(props.total) });
  const bar = Math.round(((index + 1) / Math.max(props.total ?? steps.length, steps.length)) * 100);
  const answered = steps.slice(0, index).filter(s => s.value !== null);
  return (
    <>
      <noscript dangerouslySetInnerHTML={{ __html: NO_SCRIPT }} />
      <div data-lead-chrome="" className={cn("flex flex-col gap-2", c?.progress)}>
        <Progress value={bar} aria-hidden="true" className="h-1" />
        <p aria-live="polite" className="sr-only">
          {progress}
        </p>
        {index > 0 && (
          <Button type="button" variant="link" size="touch" className={cn("self-start px-0", c?.stepBack)} onClick={props.onBack}>
            {text.stepBack}
          </Button>
        )}
      </div>
      {answered.length > 0 && (
        <ul data-lead-chrome="" className={cn("flex flex-wrap gap-2", c?.answers)}>
          {answered.map(s => (
            <li key={s.id}>
              <Button type="button" variant="outline" size="touch" className={cn("h-auto gap-2 px-3 text-sm", c?.answer)} onClick={() => props.onEdit(s.id)}>
                <span className="sr-only">{`${s.label}, `}</span>
                <span className="font-medium text-ink">{s.value}</span>
                <span className="text-ink-soft underline underline-offset-4">{text.change}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {steps.map(s => (
        <div key={s.id} data-lead-step={s.id} {...(s.id === current ? {} : { [STEP_OFF]: "", style: OFF })} className={cn("flex flex-col gap-5", c?.step)}>
          <Fragment key="screen">{s.node}</Fragment>
        </div>
      ))}
    </>
  );
}

/** The intro question: a tile per answer, the brand's icon on it, posted under its `field`. Not required: a lead without it is still a lead. */
export function IntroField(props: {
  intro: LeadIntro;
  value: string | undefined;
  onPick: (value: string, radio: HTMLInputElement) => void;
  onSelect: (value: string) => void;
  classNames?: PartClassNames<StepsPart> | undefined;
}) {
  const { intro, classNames: c } = props;
  return (
    <TileGroup
      name={intro.field}
      legend={intro.label}
      options={intro.options.map(o => ({ value: o.value, label: o.label, ...(o.icon !== undefined ? { icon: o.icon } : {}) }))}
      value={props.value}
      required={false}
      field={intro.field}
      enterPicks
      onPick={props.onPick}
      onSelect={props.onSelect}
      classNames={{ field: c?.intro, legend: c?.label, grid: "grid grid-cols-1 gap-2", tile: cn("gap-3 px-4 py-3", c?.introOption), icon: c?.icon }}
    />
  );
}
