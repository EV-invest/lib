import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fuses class fragments into one string with real Tailwind conflict resolution:
 * `clsx` drops falsy fragments and joins the rest, `tailwind-merge` resolves
 * conflicting utilities so the rightmost wins (`cn("p-4", "p-2") === "p-2"`). A
 * caller's `className` override, passed last, therefore beats the base classes.
 *
 * `twMerge` parses every utility on every render, and the overwhelmingly common
 * call is one kit constant plus a `className` override that is absent — so that
 * call returns the constant untouched.
 *
 * The Rust mirror is the `cn!` macro in `ev_lib::uikit` (`tailwind_fuse::tw_merge!`).
 */
export function cn(...inputs: ClassValue[]): string {
  if (inputs.length === 2 && typeof inputs[0] === "string" && !inputs[1]) {
    return inputs[0];
  }
  return twMerge(clsx(inputs));
}
