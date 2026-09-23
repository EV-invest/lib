import "server-only";
import { statusTarget } from "@evinvest/kitstart";
import { StatusScreen } from "@evinvest/kitstart/react";
import { copyFor } from "@/entities/content";
import type { Locale } from "@/shared/config/i18n";
import { site } from "@/shared/config/site";

/**
 * The 404 for a dead path the proxy recognised, rendered on the server into
 * the response: a visitor without JavaScript and a crawler get the offer and
 * the right place's phone, in the path's language.
 */
export function Gone({ locale, location }: { locale: Locale; location: string | null }) {
  const target = statusTarget(site, { locale, location: location ?? undefined });
  const copy = copyFor(target.locale, { place: target.place?.name[target.locale] ?? site.brand.name, phone: target.phone });
  return (
    <>
      <title>{`${copy.t.notFound.title} · ${site.brand.name}`}</title>
      <StatusScreen
        copy={copy}
        status={copy.t.notFound}
        target={target}
        locales={site.i18n.locales}
        labels={site.i18n.labels}
        brandName={site.brand.name}
      />
    </>
  );
}
