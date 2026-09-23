"use client";

import { statusTarget } from "@evinvest/kitstart";
import { StatusScreen } from "@evinvest/kitstart/react";
import { useParams } from "next/navigation";
import { copyFor } from "@/entities/content";
import { site } from "@/shared/config/site";

/**
 * A real 404 that still answers in the page's language with the right
 * place's phone. It reads the route params, never the request: the boundary
 * is rendered into every cached page. A client module so `dynamic()` can keep
 * it (and both languages' copy) out of every page's first load.
 */
export function NotFound() {
  const target = statusTarget(site, useParams<{ locale?: string; location?: string }>() ?? {});
  const copy = copyFor(target.locale, { place: target.place?.name[target.locale] ?? site.brand.name, phone: target.phone });
  return (
    <>
      <title>{`${copy.t.notFound.title} · ${site.brand.name}`}</title>
      <StatusScreen copy={copy} status={copy.t.notFound} target={target} locales={site.i18n.locales} brandName={site.brand.name} />
    </>
  );
}
