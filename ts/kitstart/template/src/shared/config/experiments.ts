import type { AbSwitcherExperiment } from "@evinvest/kitstart/react";

/**
 * The experiments the QA menu switches — a demo: the template's proxy runs
 * none, so a forced `?ab_lead_form=b` changes nothing here. A brand lists the
 * experiments its proxy assigns, with the QA cookie its force parameter sets.
 */
export const EXPERIMENTS: readonly AbSwitcherExperiment[] = [
  {
    key: "lead_form",
    label: "Lead form",
    variants: [
      { value: "a", label: "Compact" },
      { value: "b", label: "Steps" },
      { value: "c", label: "Price first" },
    ],
  },
];

/** Set by `?ab_<key>=<value>`; a visit carrying it is a test, and sees the menu. */
export const QA_COOKIE = "ab__qa";
