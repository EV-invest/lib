import { sitemapRoute } from "@evinvest/kitstart/next";
import { places } from "@/shared/config/env";
import { site } from "@/shared/config/site";

/** Per host, strict: a failing live source is a 5xx, never a shorter list. */
export const dynamic = "force-dynamic";

export default sitemapRoute(site, places);
