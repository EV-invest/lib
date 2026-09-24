import { cn } from "@evinvest/uikit";

/**
 * Where the van goes, as chips. A visitor's first question is whether you
 * come to them at all; a service-area business has no map to show instead.
 */
export function AreaChips({ areas, className, chipClassName }: { areas: readonly string[]; className?: string; chipClassName?: string }) {
  if (areas.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2 md:gap-2.5", className)}>
      {areas.map(area => (
        <li key={area} className={cn("rounded-full border border-border bg-muted px-4 py-2 text-sm font-medium text-ink-mid", chipClassName)}>
          {area}
        </li>
      ))}
    </ul>
  );
}
