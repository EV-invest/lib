import { statusTarget } from "@evinvest/kitstart";
import { statusMetadata } from "@evinvest/kitstart/next";
import { StatusScreen } from "@evinvest/kitstart/react";
import type { Metadata } from "next";
import { loadPlace } from "@/entities/place/server";
import { site } from "@/shared/config/site";

type Props = { params: Promise<{ locale: string; location: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { copy } = await loadPlace(params);
  return statusMetadata(site, copy.t.thanks.title);
}

/** The form's receipt, on the place's own links: not indexed, not a page view. */
export default async function PlaceThanks({ params }: Props) {
  const { copy } = await loadPlace(params);
  const target = statusTarget(site, await params, { thanks: true });
  return <StatusScreen copy={copy} status={copy.t.thanks} target={target} locales={site.i18n.locales} brandName={site.brand.name} />;
}
