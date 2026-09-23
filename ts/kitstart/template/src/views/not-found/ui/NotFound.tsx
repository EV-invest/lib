"use client";

import { brandStatusTarget } from "@evinvest/kitstart";
import { StatusScreen } from "@evinvest/kitstart/react";
import { useParams } from "next/navigation";
import { copyFor } from "@/entities/content";
import { i18n } from "@/shared/config/i18n";
import { BRAND_PUBLIC } from "@/shared/config/public";

/**
 * The `notFound()` boundary, for what the proxy could not foresee — a place
 * the live source withdrew. It speaks for the brand: the site config (and its
 * places) must not ride into every page's bundle. Every dead path the proxy
 * does know is rendered on the server by `app/global-not-found.tsx` instead.
 */
export function NotFound() {
  const params = useParams<{ locale?: string }>();
  const locale = i18n.isLocale(params?.locale) ? params.locale : i18n.defaultLocale;
  const target = brandStatusTarget({ locales: i18n.locales, phone: BRAND_PUBLIC.phone }, locale);
  const copy = copyFor(locale, { place: BRAND_PUBLIC.name, phone: BRAND_PUBLIC.phone });
  return (
    <>
      <title>{`${copy.t.notFound.title} · ${BRAND_PUBLIC.name}`}</title>
      <StatusScreen copy={copy} status={copy.t.notFound} target={target} locales={i18n.locales} labels={i18n.labels} brandName={BRAND_PUBLIC.name} />
    </>
  );
}
