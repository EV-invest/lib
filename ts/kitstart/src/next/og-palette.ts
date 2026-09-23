/**
 * The OG card's colours, inlined at build by `withLanding` from
 * `assets/brand.toml` `[colors.dark]` (`SITE_OG_PALETTE`). `ImageResponse`
 * draws with inline styles and cannot read a custom property, so the card
 * takes the palette's values rather than a second copy of them in code.
 */
export interface OgColours {
  background: string;
  card: string;
  ink: string;
  inkSoft: string;
  primary: string;
}

export function ogPalette(inlined: string | undefined = process.env["SITE_OG_PALETTE"]): OgColours {
  if (inlined === undefined) throw new Error("SITE_OG_PALETTE was not inlined — build through withLanding (next.config.ts)");
  const raw: unknown = JSON.parse(inlined);
  if (typeof raw !== "object" || raw === null) throw new Error("SITE_OG_PALETTE is not an object");
  const pick = (k: keyof OgColours): string => {
    const v: unknown = Reflect.get(raw, k);
    if (typeof v !== "string") throw new Error(`SITE_OG_PALETTE.${k} is missing`);
    return v;
  };
  return { background: pick("background"), card: pick("card"), ink: pick("ink"), inkSoft: pick("inkSoft"), primary: pick("primary") };
}
