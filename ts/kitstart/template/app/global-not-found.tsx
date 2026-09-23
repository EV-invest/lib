import "./globals.css";
import { GONE_HEADER, parseGoneHeader } from "@evinvest/kitstart";
import { headers } from "next/headers";
import { site } from "@/shared/config/site";
import { text } from "@/shared/ui/fonts";
import { Gone } from "@/views/not-found/server";

/**
 * Every path no route matches — among them each dead path the proxy sends
 * here (`gone`) — answered 404 with the brand's screen rendered on the
 * server, so a visitor without JavaScript still gets the offer and the phone.
 * A document of its own: the root layout lives under `[locale]`.
 *
 * It reads the proxy's header, which only this route does: it is not a
 * boundary inside the cached pages, so they stay static. The proxy strips a
 * client-sent copy. No `robots` here: Next already emits `noindex` for a 404.
 */
export default async function GlobalNotFound() {
  const gone = parseGoneHeader((await headers()).get(GONE_HEADER));
  const locale = site.i18n.isLocale(gone.locale) ? gone.locale : site.i18n.defaultLocale;
  return (
    <html lang={locale} data-brand={site.brand.id} className={`light ${text.variable}`}>
      <body>
        <Gone locale={locale} location={gone.location ?? null} />
      </body>
    </html>
  );
}
