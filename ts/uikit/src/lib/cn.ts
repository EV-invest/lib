import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fuses class fragments into one string with real Tailwind conflict resolution:
 * `clsx` drops falsy fragments and joins the rest, `tailwind-merge` resolves
 * conflicting utilities so the rightmost wins (`cn("p-4", "p-2") === "p-2"`). A
 * caller's `className` override, passed last, therefore beats the base classes.
 *
 * The Rust mirror is the `cn!` macro in `ev::uikit` (`tailwind_fuse::tw_merge!`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
