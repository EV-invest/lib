import { ImageResponse } from "next/og.js";
import type { ReactElement } from "react";
import { memoByKey } from "../core/memo";
import type { Place } from "../core/place/types";
import { bakedPlace, type Site } from "../core/site";

/**
 * `app/og/route.tsx`: the OG card, drawn by the brand from the same fields the
 * `<head>` reads. The query is normalised to the closed set of (place,
 * language, page) before it is a cache key — an unknown one falls back to a
 * known one — and each card is drawn once per process: satori and resvg are
 * the most expensive thing the server does, and a crawler fetching every card
 * must not make them the most frequent. Baked data only.
 */
export interface OgCard<L extends string, P extends string> {
  locale: L;
  /** The baked place, or `null` for the brand's own card. */
  place: Place<L> | null;
  page: P | "home";
}

export interface OgFont {
  name: string;
  data: ArrayBuffer | Buffer;
  weight?: 400 | 500 | 600 | 700;
  style?: "normal" | "italic";
}

export interface OgOptions<L extends string, P extends string> {
  draw: (card: OgCard<L, P>) => ReactElement;
  /** Read once per card; the brand ships them via `outputFileTracingIncludes`. */
  fonts: () => Promise<OgFont[]>;
  width?: number;
  height?: number;
}

export function ogRoute<L extends string, P extends string>(
  site: Site<L, P>,
  options: OgOptions<L, P>,
): (request: Request) => Promise<Response> {
  const width = options.width ?? 1200;
  const height = options.height ?? 630;
  // Read once per process, like the cards; a failed read is retried next time.
  let fonts: Promise<OgFont[]> | undefined;
  const loadFonts = (): Promise<OgFont[]> => {
    fonts ??= options.fonts().catch((error: unknown) => {
      fonts = undefined;
      throw error;
    });
    return fonts;
  };
  const card = memoByKey(async (key: string): Promise<ArrayBuffer> => {
    const [slug = "", lang = "", p = ""] = key.split("|");
    const locale = site.i18n.isLocale(lang) ? lang : site.i18n.defaultLocale;
    const page = site.pageKeys.find(k => k === p) ?? "home";
    const faces = await loadFonts();
    // An empty list would replace `next/og`'s bundled face with nothing.
    const image = new ImageResponse(options.draw({ locale, place: bakedPlace(site, slug) ?? null, page }), {
      width,
      height,
      ...(faces.length > 0 ? { fonts: faces } : {}),
    });
    return image.arrayBuffer();
  });

  return async request => {
    const url = new URL(request.url);
    const lang = url.searchParams.get("lang");
    const p = url.searchParams.get("p");
    const key = [
      bakedPlace(site, url.searchParams.get("l") ?? "")?.slug ?? "",
      site.i18n.isLocale(lang) ? lang : site.i18n.defaultLocale,
      site.pageKeys.find(k => k === p) ?? "home",
    ].join("|");
    return new Response(await card(key), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  };
}
