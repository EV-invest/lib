import { createProxy } from "@evinvest/kitstart/proxy";
import { site } from "@/shared/config/site";

export const proxy = createProxy(site);

export const config = {
  // A literal: Next reads it statically. Everything but the build output,
  // files included: `decide` passes the routes outside `[locale]` and
  // `site.publicFiles`, and sends any other path to the 404.
  matcher: ["/((?!_next/).*)"],
};
