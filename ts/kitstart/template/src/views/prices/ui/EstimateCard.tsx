import { contactOf, type PlaceView, type PricingModel } from "@evinvest/kitstart";
import { LeadCapture } from "@evinvest/kitstart/react";
import type { ReactNode } from "react";
import type { Copy } from "@/entities/content";
import type { Locale } from "@/shared/config/i18n";
import { LEAD, PHOTO_NEEDS, type Subject } from "@/shared/config/lead";
import { site } from "@/shared/config/site";

/** A placeholder mark per need: a brand draws its own. Hidden from assistive technology by the card. */
const icon = (d: string): ReactNode => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS: Record<Subject, ReactNode> = {
  standard: icon("M4 20h16M6 20V9l6-5 6 5v11"),
  deep: icon("M12 3v18M3 12h18"),
  other: icon("M12 8v4m0 4h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18"),
  recurring: icon("M4 12a8 8 0 0 1 14-5.3L20 9M20 12a8 8 0 0 1-14 5.3L4 15"),
};

/**
 * The prices page's estimate: the kit's `LeadCapture` one question a screen
 * (`steps`) — how urgent first (an urgent job is a call back, the phone
 * alone), the need as cards, the regular clean's answers with "I don't know"
 * for the surface and the frequency as cards that carry their price, and the
 * price on one line with the tax credit. A card of its own (`#estimate`), so
 * the home page's form and its call bar are untouched.
 */
export function EstimateCard({ view, copy, renderedAt, model }: { view: PlaceView<Locale>; copy: Copy; renderedAt: number; model: PricingModel | null }) {
  const { t } = copy;
  const e = t.estimateForm;
  return (
    <LeadCapture
      id="estimate"
      formId="estimate"
      layout="steps"
      place={view.place}
      contact={contactOf(site, view.place)}
      locale={view.locale}
      renderedAt={renderedAt}
      wire={LEAD.wire}
      needs={LEAD.subjects.map(s => ({ value: s, label: t.subjects[s], icon: ICONS[s] }))}
      needDisplay="cards"
      intro={{
        label: e.when.label,
        field: "urgency",
        options: [
          { value: "today", label: e.when.today, channel: "callback" },
          { value: "week", label: e.when.week },
          { value: "compare", label: e.when.compare },
        ],
      }}
      flows={LEAD.flows}
      pricing={model}
      photos={PHOTO_NEEDS}
      questions={{ surface: { unknown: true }, frequency: { display: "cards", badges: { biweekly: e.badge } } }}
      price="compact"
      taxCredit={0.5}
      afterPhone={<p className="text-sm text-ink-soft">{e.afterPhone}</p>}
      channelsDisplay="row"
      text={{ ...t.leadCapture, title: e.title, lede: e.lede, privacy: "" }}
      className="max-w-md"
    />
  );
}
