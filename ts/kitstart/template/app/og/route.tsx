import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ogPalette, ogRoute } from "@evinvest/kitstart/next";
import { TEXT } from "@/entities/content";
import { site } from "@/shared/config/site";

/** Drawn once per (place, language, page) per process; baked data only. */
export const dynamic = "force-dynamic";

/** `[colors.dark]` of assets/brand.toml, inlined at build — not a second copy here. */
const c = ogPalette();

export const GET = ogRoute(site, {
  // `withLanding({ ogFiles })` traces the file into the standalone output.
  fonts: async () => [{ name: "Inter", data: await readFile(join(process.cwd(), "assets/fonts/Inter-Regular.ttf")), weight: 400, style: "normal" }],
  draw: ({ locale, place, page }) => {
    const t = TEXT[locale];
    const f = { place: place?.name[locale] ?? site.brand.name, phone: site.brand.phone };
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 72, background: c.background, color: c.ink, fontFamily: "Inter" }}>
        <div style={{ display: "flex", fontSize: 44, color: c.primary }}>{site.brand.name}</div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", fontSize: 68 }}>{t.pages[page].title(f)}</div>
        {f.phone && <div style={{ display: "flex", fontSize: 28, color: c.inkSoft }}>{f.phone}</div>}
      </div>
    );
  },
});
