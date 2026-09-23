import { faqPageNode } from "@evinvest/kitstart";
import { placeMetadata } from "@evinvest/kitstart/next";
import { Faq, JsonLd, Section } from "@evinvest/kitstart/react";
import type { Metadata } from "next";
import { loadPlace } from "@/views/place/server";
import { site } from "@/shared/config/site";

type Props = { params: Promise<{ locale: string; location: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { view, copy } = await loadPlace(params);
  const page = copy.t.pages.prices;
  return placeMetadata(site, view, "prices", { title: page.title(copy.f), description: page.description(copy.f) });
}

export default async function PricesPage({ params }: Props) {
  const { copy } = await loadPlace(params);
  return (
    <main>
      <JsonLd data={faqPageNode(copy.t.faqs)} />
      <Section>
        <Faq items={copy.t.faqs} />
      </Section>
    </main>
  );
}
