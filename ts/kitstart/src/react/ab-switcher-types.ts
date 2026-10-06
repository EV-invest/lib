/** One variant of an experiment, as the menu offers it. */
export interface AbSwitcherVariant {
  /** The value the force parameter carries and the cookie holds: `b`. */
  value: string;
  label: string;
}

/** One experiment the menu switches. */
export interface AbSwitcherExperiment {
  /** The experiment's key: the cookie is `ab_<key>`, the force parameter `<forceParam><key>`. */
  key: string;
  label?: string;
  variants: readonly AbSwitcherVariant[];
}

/** The menu's words; English unless the brand says otherwise. */
export interface AbSwitcherText {
  /** The chip's and the panel's accessible name. */
  title: string;
  reset: string;
  leave: string;
  minimize: string;
  hide: string;
  /** Shown for an experiment no cookie assigns yet. */
  unassigned: string;
}

/**
 * Plain data, so a server layout mounts it. Positioned by `className`: a brand
 * lifts the chip over its own sticky bars.
 */
export interface AbSwitcherProps {
  experiments: readonly AbSwitcherExperiment[];
  /** The cookie the brand's force parameter sets to mark a test visit: `ab__qa`. */
  qaCookie: string;
  /** The assignments, when the caller knows them; otherwise read from `ab_<key>` cookies. */
  current?: Readonly<Record<string, string>>;
  /** The prefix of the parameter that forces a variant; `ab_` by default. */
  forceParam?: string;
  className?: string;
  text?: Partial<AbSwitcherText>;
}
