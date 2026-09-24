import { contactOf, placeGraph, type PlaceView } from "@evinvest/kitstart";
import {
  Button,
  CallBar,
  Coverage,
  Display,
  Faq,
  Field,
  FieldLabel,
  FormSelect,
  Input,
  JsonLd,
  PHONE_INPUT_PROPS,
  QuoteFormShell,
  Section,
} from "@evinvest/kitstart/react";
import type { Copy } from "@/entities/content";
import type { Locale } from "@/shared/config/i18n";
import { LEAD } from "@/shared/config/lead";
import { site } from "@/shared/config/site";

/**
 * A place's home page: the brand's own hero, the package's structural
 * widgets, and the JSON-LD derived from the same copy. Replace the hero with
 * the brand's sections; keep the form's field names on `site.lead.wire`.
 */
export function PlaceHome({ view, copy, renderedAt }: { view: PlaceView<Locale>; copy: Copy; renderedAt: number }) {
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
          <QuoteFormShell placeSlug={view.place.slug} locale={view.locale} renderedAt={renderedAt} honeypotLabel={t.quoteForm.honeypotLabel} className="max-w-md">
            <p className="font-display text-2xl font-bold text-ink">{t.quoteForm.title}</p>
            <Field className="flex flex-col gap-2">
              <FieldLabel>{t.quoteLabels.subject}</FieldLabel>
              <FormSelect
                name={LEAD.wire.subject}
                size="lg"
                defaultValue={LEAD.subjects[0]}
                options={LEAD.subjects.map(s => ({ value: s, label: t.subjects[s] }))}
              />
            </Field>
            <Field className="flex flex-col gap-2">
              <FieldLabel>{t.quoteLabels.locality}</FieldLabel>
              <Input name={LEAD.wire.locality} size="lg" autoComplete="postal-code" required />
            </Field>
            <Field className="flex flex-col gap-2">
              <FieldLabel>{t.quoteLabels.mobile}</FieldLabel>
              <Input name={LEAD.wire.mobile} size="lg" {...PHONE_INPUT_PROPS} required />
            </Field>
            <Button type="submit" size="xl">
              {t.quoteForm.submit}
            </Button>
          </QuoteFormShell>
        </Section>
        <Section id="areas">
          <Coverage place={view.place} locale={view.locale} head={<Display>{t.coverageTitle}</Display>} />
        </Section>
        <Section>
          <Faq items={t.faqs} />
        </Section>
      </main>
      <CallBar id="callbar" label={t.contactLabel} copy={copy} phone={contact.phone} whatsapp={contact.whatsapp} quoteHref={view.href("#quote")} />
    </>
  );
}
