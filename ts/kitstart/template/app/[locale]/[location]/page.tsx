import { placeMetadata } from "@evinvest/kitstart/next";
import type { Metadata } from "next";
import { loadPlace } from "@/entities/place/server";
import { site } from "@/shared/config/site";
import { PlaceHome } from "@/views/home";

type Props = { params: Promise<{ locale: string; location: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { view, copy } = await loadPlace(params);
  const page = copy.t.pages.home;
  return placeMetadata(site, view, "home", { title: page.title(copy.f), description: page.description(copy.f) });
}

export default async function PlaceHomePage({ params }: Props) {
  const { view, copy } = await loadPlace(params);
  return <PlaceHome view={view} copy={copy} renderedAt={Date.now()} />;
}
