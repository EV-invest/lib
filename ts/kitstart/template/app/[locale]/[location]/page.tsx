import { placeMetadata } from "@evinvest/kitstart/next";
import type { Metadata } from "next";
import { loadPlace } from "@/views/place/server";
import { pricing } from "@/shared/config/env";
import { site } from "@/shared/config/site";
import { PlaceHome } from "@/views/home";

type Props = { params: Promise<{ locale: string; location: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { view, copy } = await loadPlace(params);
  const page = copy.t.pages.home;
  return placeMetadata(site, view, "home", { title: page.title(copy.f), description: page.description(copy.f) });
}

export default async function PlaceHomePage({ params }: Props) {
  // The price list only where the form is: the other pages of a place need none.
  const [{ view, copy, renderedAt }, model] = await Promise.all([loadPlace(params), pricing.model()]);
  return <PlaceHome view={view} copy={copy} renderedAt={renderedAt} model={model} />;
}
