import { ogRoute } from "@evinvest/kitstart/next";
import { TEXT } from "@/entities/content";
import { site } from "@/shared/config/site";

/** Drawn once per (place, language, page) per process; baked data only. */
export const dynamic = "force-dynamic";

export const GET = ogRoute(site, {
  // No brand fonts yet: `next/og`'s bundled face. Add `.ttf`s under
  // assets/fonts and read them here (`withLanding` traces `ogFiles`).
  fonts: async () => [],
  draw: ({ locale, place, page }) => {
    const t = TEXT[locale];
    const f = { place: place?.name[locale] ?? site.brand.name, phone: site.brand.phone };
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 72, background: "#051726", color: "#ffffff" }}>
        <div style={{ display: "flex", fontSize: 44 }}>{site.brand.name}</div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", fontSize: 68 }}>{t.pages[page].title(f)}</div>
      </div>
    );
  },
});
