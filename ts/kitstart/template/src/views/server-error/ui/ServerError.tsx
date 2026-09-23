"use client";

import { StatusScreen } from "@evinvest/kitstart/react";
import { useParams, usePathname } from "next/navigation";
import { copyFor } from "@/entities/content";
import { i18n } from "@/shared/config/i18n";
import { BRAND_PUBLIC } from "@/shared/config/public";

/**
 * The 500. Client-only by Next's contract, and it imports `BRAND_PUBLIC`, not
 * the site config: the name and the phone are all it prints, and the phone
 * works whatever broke.
 */
export function ServerError() {
  const params = useParams<{ locale?: string }>();
  const pathname = usePathname();
  const locale = i18n.isLocale(params?.locale) ? params.locale : i18n.defaultLocale;
  const copy = copyFor(locale, { place: BRAND_PUBLIC.name, phone: BRAND_PUBLIC.phone });
  const langHrefs = { fr: "/fr", en: "/en" } as const;
  return (
    <StatusScreen
      copy={copy}
      status={copy.t.serverError}
      target={{ phone: BRAND_PUBLIC.phone, home: `/${locale}`, retry: pathname, langHrefs }}
      locales={i18n.locales}
      brandName={BRAND_PUBLIC.name}
    />
  );
}
