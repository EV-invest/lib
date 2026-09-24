import { cn } from "@evinvest/uikit";

/**
 * Class names for a widget's named parts, merged after its own through `cn`
 * (tailwind-merge), so a brand's `gap-3` replaces the kit's `gap-6`. The
 * geometry a brand needs, without descendant selectors that break silently
 * when the widget's markup moves.
 */
export type PartClassNames<P extends string> = Readonly<Partial<Record<P, string>>>;

// Probes no brand writes: a probe equal to a brand's class would merge into it
// and read as "no conflict".
const LEADING_PROBE = "leading-[0.001]";
const SIZE_PROBE = "text-[0.001px]";

const conflictsWith = (probe: string, token: string): boolean => !cn(probe, token).split(" ").includes(probe);

/**
 * Whether a part's classes set a line height of their own — a `leading-*`, or
 * a size with one (`text-lg/7`) — at the base variant. tailwind-merge decides
 * the conflicts, so variants and `!` are read the way the merge reads them.
 */
function setsLineHeight(part: string): boolean {
  return part
    .split(/\s+/)
    .filter(Boolean)
    .some(token => {
      if (!conflictsWith(LEADING_PROBE, token)) return false;
      if (!conflictsWith(SIZE_PROBE, token)) return true;
      // A size: it carries a line height only after a `/` outside brackets.
      return token.replace(/\[[^\]]*\]/g, "").includes("/");
    });
}

/**
 * `cn(base, part)` for a part that has a line height: tailwind-merge drops an
 * earlier `leading-*` for any later font size, so `text-[88px]` from a brand
 * would silently take the kit's `leading-none` with it. `leading` goes after
 * the brand's classes instead — unless they set a line height themselves.
 */
export function partWithLeading(base: string, leading: string, part: string | undefined): string {
  return part && setsLineHeight(part) ? cn(base, part) : cn(base, part, leading);
}
