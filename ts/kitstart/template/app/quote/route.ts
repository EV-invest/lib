import { quoteRoute } from "@evinvest/kitstart/next";
import { TEXT } from "@/entities/content";
import { notifier, pricing, serverEnv } from "@/shared/config/env";
import { QA_COOKIE } from "@/shared/config/experiments";
import { site } from "@/shared/config/site";

/** The no-JS path: a plain form POST answered with a 303. */
export const dynamic = "force-dynamic";

export const POST = quoteRoute(site, {
  env: serverEnv,
  notifier,
  pricing,
  // The layout's `AnalyticsBoundary` gets the same: a QA visit's lead says `forced: true`.
  qaCookie: QA_COOKIE,
  unavailable: locale => {
    const t = TEXT[locale];
    const f = { place: site.brand.name, phone: site.brand.phone };
    return { title: t.serverError.title, heading: t.serverError.headline.join(""), body: t.serverError.body(f), callLabel: t.callLabel(f) };
  },
});
