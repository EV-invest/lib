import { contactOf, placeGraph, type PlaceView, type PricingModel } from "@evinvest/kitstart";
import { CallBar, Coverage, Display, Faq, JsonLd, LeadCapture, Section } from "@evinvest/kitstart/react";
import type { Copy } from "@/entities/content";
import type { Locale } from "@/shared/config/i18n";
import { LEAD, PHOTO_NEEDS } from "@/shared/config/lead";
import { site } from "@/shared/config/site";

/**
 * A place's home page: the brand's own hero, the package's structural
 * widgets, and the JSON-LD derived from the same copy. Replace the hero with
 * the brand's sections; the form is the kit's `LeadCapture`, posting under
 * `site.lead.wire` — restyle it through `classNames`, drive `layout` and
 * `prefer` from an experiment.
 */
export function PlaceHome({ view, copy, renderedAt, model }: { view: PlaceView<Locale>; copy: Copy; renderedAt: number; model: PricingModel | null }) {
  const { t, f } = copy;
  const contact = contactOf(site, view.place);
  const graph = placeGraph(site, view, "home", { placeName: f.place, title: t.pages.home.title(f), description: t.pages.home.description(f) }, new Date(renderedAt));
  return (
    <>
      <JsonLd data={graph} />
      <main>
        <Section>
          <Display>{t.hero.title(f)}</Display>
          <p className="mt-4 text-lg text-ink-soft">{t.hero.lede}</p>
        </Section>
        <Section surface="card" id="quote-band">
          <LeadCapture
            place={view.place}
            contact={contact}
            locale={view.locale}
            renderedAt={renderedAt}
            wire={LEAD.wire}
            needs={LEAD.subjects.map(s => ({ value: s, label: t.subjects[s] }))}
            flows={LEAD.flows}
            pricing={model}
            photos={PHOTO_NEEDS}
            text={t.leadCapture}
            className="max-w-md"
          />
        </Section>
        <Section id="areas">
          <Coverage place={view.place} locale={view.locale} head={<Display>{t.coverageTitle}</Display>} />
        </Section>
        <Section>
          <Faq items={t.faqs} />
        </Section>
      </main>
      <CallBar
        id="callbar"
        label={t.contactLabel}
        copy={copy}
        phone={contact.phone}
        whatsapp={contact.whatsapp}
        quoteHref={view.href("#quote")}
        hours={view.place.hours}
        now={renderedAt}
        callback={{ href: view.href("#quote-callback"), label: t.leadCapture.callback }}
      />
    </>
  );
}
