import { quoteRoute } from "@evinvest/kitstart/next";
import { TEXT } from "@/entities/content";
import { notifier, serverEnv } from "@/shared/config/env";
import { site } from "@/shared/config/site";

/** The no-JS path: a plain form POST answered with a 303. */
export const dynamic = "force-dynamic";

export const POST = quoteRoute(site, {
  env: serverEnv,
  notifier,
  unavailable: locale => {
    const t = TEXT[locale];
    const f = { place: site.brand.name, phone: site.brand.phone };
    return { title: t.serverError.title, heading: t.serverError.headline.join(""), body: t.serverError.body(f), callLabel: t.callLabel(f) };
  },
});
