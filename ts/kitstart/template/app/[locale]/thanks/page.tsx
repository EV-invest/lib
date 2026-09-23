import { statusTarget } from "@evinvest/kitstart";
import { loadLocale, statusMetadata } from "@evinvest/kitstart/next";
import { StatusScreen } from "@evinvest/kitstart/react";
import type { Metadata } from "next";
import { copyFor } from "@/entities/content";
import { site } from "@/shared/config/site";

/** Where a lead with no place lands. The lead is stored all the same. */
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await loadLocale(site, params);
  return statusMetadata(site, copyFor(locale, { place: site.brand.name, phone: site.brand.phone }).t.thanks.title);
}

export default async function BrandThanks({ params }: Props) {
  const locale = await loadLocale(site, params);
  const target = statusTarget(site, { locale }, { thanks: true });
  const copy = copyFor(locale, { place: site.brand.name, phone: target.phone });
  return <StatusScreen copy={copy} status={copy.t.thanks} target={target} locales={site.i18n.locales} brandName={site.brand.name} />;
}
