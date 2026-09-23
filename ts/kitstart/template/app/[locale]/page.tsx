import { brandMetadata, loadLocale } from "@evinvest/kitstart/next";
import { PlaceDirectory } from "@evinvest/kitstart/react";
import { contactOf, placeUrl } from "@evinvest/kitstart";
import type { Metadata } from "next";
import { TEXT } from "@/entities/content";
import { places } from "@/shared/config/env";
import { site } from "@/shared/config/site";

/**
 * The apex of a `subdomains` site: a directory of its places. On a `single`
 * site the proxy rewrites `/fr` to the place's own route and this never renders.
 */
export function generateStaticParams(): { locale: string }[] {
  return [];
}

export const revalidate = 600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await loadLocale(site, params);
  const { title, description } = TEXT[locale].brandPage;
  return brandMetadata(site, locale, { title, description });
}

export default async function BrandPage({ params }: Props) {
  const locale = await loadLocale(site, params);
  return (
    <main className="p-8">
      <PlaceDirectory
        places={await places.listPlaces(locale, "page")}
        locale={locale}
        hrefOf={p => placeUrl(site, p.slug, locale, "")}
        phoneOf={p => contactOf(site, p).phone}
        openLabel={TEXT[locale].brandPage.open}
      />
    </main>
  );
}
