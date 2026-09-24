/**
 * Class names for a widget's named parts, merged after its own through `cn`
 * (tailwind-merge), so a brand's `gap-3` replaces the kit's `gap-6`. The
 * geometry a brand needs, without descendant selectors that break silently
 * when the widget's markup moves.
 */
export type PartClassNames<P extends string> = Readonly<Partial<Record<P, string>>>;
