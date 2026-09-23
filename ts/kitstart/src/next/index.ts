/**
 * `@evinvest/kitstart/next` — the handlers and loaders the brand's `app/`
 * files take, so each route file is a few lines of literal segment config and
 * one factory call. Server side only (route handlers, Server Components,
 * `generateMetadata`); `next.config.ts` imports `./next/config` instead.
 */
export { brandMetadata, metadataBase, placeMetadata, statusMetadata, type PageMeta } from "./metadata";
export { createPlaceLoader, loadLocale, type PlaceParams } from "./load";
export { healthRoute, robotsRoute, sitemapRoute } from "./routes";
export { ogRoute, type OgCard, type OgFont, type OgOptions } from "./og";
export { quoteRoute, type QuoteRouteDeps, type UnavailableCopy } from "./quote-route";
