import { confirmRoute } from "@evinvest/kitstart/next";
import { TEXT } from "@/entities/content";
import { pricing } from "@/shared/config/env";
import { site } from "@/shared/config/site";

/**
 * A form posted without a script whose price changed lands here: a page that
 * is never cached, with the fresh price to confirm.
 */
export const dynamic = "force-dynamic";

export const GET = confirmRoute(site, { pricing, text: locale => TEXT[locale].leadCapture });
