"use client";

import { Button, cn } from "@evinvest/uikit";
import { useRef, useState, type ReactNode } from "react";
import { resolveChannels, type CaptureChannel } from "../core/channels";
import type { LeadWire } from "../core/lead";
import { fillText, openingText } from "../core/lead-capture-format";
import type { LeadCaptureText } from "../core/lead-capture-text";
import { servedLocalities, storefrontOf, type Place } from "../core/place/types";
import type { FormSelectOption } from "./FormSelect";
import { CallbackForm, ChannelLink, ExperimentFields, type ChannelPart, type Experiment } from "./LeadCaptureChannels";
import { LocalityField, NameField, PhoneField, type FieldPart } from "./LeadCaptureFields";
import { NeedField, type LeadCaptureLayout } from "./LeadCaptureNeed";
import type { PartClassNames } from "./parts";
import { QuoteFormShell } from "./QuoteFormShell";
import { useHydrated, useNeed, useNow, useOpenOnHash } from "./use-lead-context";
import { useLeadEvents } from "./use-lead-events";

export type LeadCapturePart =
  | "root" | "head" | "title" | "lede" | "form" | "contact" | "submit" | "trust" | "privacy" | "opening" | "others"
  | "needs" | "need" | "summary" | FieldPart | ChannelPart;

export interface LeadCaptureProps {
  /** Its hours order the channels; its service area suggests the commune. */
  place: Place<string>;
  /** `contactOf(site, place)`: the place's numbers, the brand's as fallback. A `null` channel is not offered. */
  contact: { phone: string | null; whatsapp: string | null };
  locale: string;
  /** When the page rendered (the time trap's stamp, and "now" until the script runs). */
  renderedAt: number;
  /** `site.lead.wire`: the names the funnel reads. */
  wire: LeadWire;
  /** The brand's subjects with their labels, in order. */
  needs: readonly FormSelectOption[];
  /** The need the page already knows; `?need=` and `[data-need]` triggers set it too. */
  need?: string | undefined;
  /** `single` (one screen) or `qualify-first` (the need, then the contact) — an experiment's switch. */
  layout?: LeadCaptureLayout | undefined;
  locality?: "required" | "optional" | undefined;
  /** A name field, posted as the brand's extra `field`. Off by default: every field costs leads. */
  name?: { field: string; required?: boolean } | undefined;
  /** The brand's extra fields, after the phone — never before it. */
  extras?: ReactNode;
  /** Moved first when available — a `default_channel` experiment's arm. */
  prefer?: CaptureChannel | undefined;
  /** The site's assignment: on every event, and posted with the form. Slugs only. */
  experiment?: Experiment | undefined;
  timeZone?: string | undefined;
  formId?: string | undefined;
  /**
   * The card's id, the anchor a call bar links to (`#quote`): the whole card,
   * head included, scrolls into view. The form is `<id>-form`, the callback
   * `<id>-callback` and its form `<id>-callback-form`.
   */
  id?: string | undefined;
  text: LeadCaptureText;
  /**
   * `hidden`: every field's label for assistive technology only (`sr-only`) —
   * for a design that draws placeholders instead (`text.*Placeholder`).
   */
  labels?: "visible" | "hidden" | undefined;
  /** Replaces the title and lede — the brand's own heading. */
  head?: ReactNode;
  /** Beside the submit: a guarantee, a live rating. */
  trust?: ReactNode;
  className?: string | undefined;
  classNames?: PartClassNames<LeadCapturePart> | undefined;
}

/**
 * What the locality field is offered. A storefront serving its own town knows
 * that town's postcode — what the field asks — so it offers that, not the
 * town's name; a named zone offers its communes, by name.
 */
function localitySuggestions(place: Place<string>): string[] {
  const postcode = place.serviceArea === null ? storefrontOf(place)?.address.postalCode : undefined;
  return postcode ? [postcode] : servedLocalities(place);
}

/**
 * The lead form every brand shares: the need (asked once, or not at all when
 * the page knows it), the postcode, the phone, and the other ways to reach the
 * business ordered by the place's hours. Over `QuoteFormShell`, so without a
 * script it is the plain POST to `/quote` it always was.
 */
export function LeadCapture(props: LeadCaptureProps) {
  const { place, contact, locale, renderedAt, wire, needs, layout = "single", text } = props;
  const { formId = "quote", id = "quote", experiment } = props;
  const c = props.labels === "hidden" ? { ...props.classNames, label: cn("sr-only", props.classNames?.label) } : props.classNames;
  const root = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  const [editing, setEditing] = useState(false);
  const [need, setNeed] = useNeed(props.need, needs.map(n => n.value), () => setEditing(false));
  const events = useLeadEvents(root, { formId, layout, experiment });
  useOpenOnHash(`${id}-callback`);
  const resolved = resolveChannels({ ...contact, hours: place.hours }, { now: new Date(useNow(renderedAt)), timeZone: props.timeZone, prefer: props.prefer });
  const opening = openingText(resolved.nextOpening, text, locale);
  const needLabel = needs.find(n => n.value === need)?.label;
  const message = needLabel ? fillText(text.message, { need: needLabel }) : text.messageGeneric;
  const [lead = "form", ...rest] = resolved.order;
  const links = rest.filter((ch): ch is "phone" | "whatsapp" | "sms" => ch !== "form" && ch !== "callback");

  const pick = (value: string) => {
    if (layout === "single") {
      setNeed(value);
      setEditing(true);
      return;
    }
    // The checked radio has already shown the contact step (`:has`, below), so
    // the first empty field — the postcode unless filled, else the phone —
    // takes focus inside the tap: iOS opens the keyboard only for a focus a
    // gesture made, and a re-render is too late for it.
    const form = `#${CSS.escape(`${id}-form`)}`;
    const fields = root.current?.querySelectorAll<HTMLInputElement>(`${form} [data-lead-field="locality"], ${form} [data-lead-field="phone"]`);
    [...(fields ?? [])].find(f => f.value === "")?.focus();
    setNeed(value);
    setEditing(false);
    events.step("contact");
  };

  const channel = (ch: CaptureChannel, primary: boolean) =>
    ch === "callback" ? (
      <CallbackForm
        key={ch}
        id={`${id}-callback`}
        open={primary}
        formId={formId}
        placeSlug={place.slug}
        locale={locale}
        renderedAt={renderedAt}
        mobileName={wire.mobile}
        subject={need ? { name: wire.subject, value: need } : null}
        opening={opening}
        text={text}
        experiment={experiment}
        classNames={c}
      />
    ) : ch === "form" ? null : (
      <ChannelLink key={ch} channel={ch} contact={contact} message={message} text={text} primary={primary} experiment={experiment} classNames={c} />
    );

  // `qualify-first` shows the contact step as soon as a need's radio is
  // checked (`:has`) — without a script, and inside the tap with one.
  const contactShown = layout === "single" || (need !== undefined && !editing);
  const contactClass = contactShown ? "flex" : "hidden group-has-[[data-need-option]:checked]/lead:flex";

  return (
    <div ref={root} id={id} className={cn("flex w-full flex-col gap-6", props.className, c?.root)} data-experiment={experiment?.name} data-variant={experiment?.variant}>
      {props.head ?? (
        <div className={cn("flex flex-col gap-1", c?.head)}>
          <p className={cn("font-display text-2xl font-bold text-ink", c?.title)}>{text.title}</p>
          <p className={cn("text-ink-soft", c?.lede)}>{text.lede}</p>
        </div>
      )}
      {lead !== "form" && channel(lead, true)}
      <QuoteFormShell id={`${id}-form`} placeSlug={place.slug} locale={locale} renderedAt={renderedAt} honeypotLabel={text.honeypotLabel} formId={formId} className={cn("group/lead", c?.form)}>
        <ExperimentFields experiment={experiment} />
        <NeedField
          layout={layout}
          name={wire.subject}
          needs={needs}
          need={need}
          editing={editing}
          hydrated={hydrated}
          label={text.needLabel}
          changeLabel={text.needChange}
          onPick={pick}
          onEdit={() => {
            setEditing(true);
            events.step("need");
          }}
          classNames={c}
        />
        <div className={cn("flex-col gap-5", contactClass, c?.contact)}>
          <LocalityField
            name={wire.locality}
            label={text.localityLabel}
            servedLabel={text.servedLabel}
            served={localitySuggestions(place)}
            placeholder={text.localityPlaceholder}
            required={props.locality !== "optional"}
            optional={text.optional}
            hydrated={hydrated}
            classNames={c}
          />
          <PhoneField name={wire.mobile} label={text.phoneLabel} hint={text.phoneHint} placeholder={text.phonePlaceholder} onSoftError={() => events.fieldError("phone")} classNames={c} />
          {props.name && (
            <NameField name={props.name.field} label={text.nameLabel} placeholder={text.namePlaceholder} required={props.name.required ?? false} optional={text.optional} classNames={c} />
          )}
          {props.extras}
          <div className={cn("flex flex-col gap-3", c?.trust)}>
            <Button type="submit" size="touch" className={cn("w-full", c?.submit)}>
              {text.submit}
            </Button>
            {props.trust}
          </div>
          {opening && lead !== "callback" && <p className={cn("text-sm text-ink-soft", c?.opening)}>{opening}</p>}
          <p className={cn("text-sm text-ink-soft", c?.privacy)}>{text.privacy}</p>
        </div>
      </QuoteFormShell>
      {(links.length > 0 || rest.includes("callback")) && (
        <div className={cn("flex flex-col gap-3", c?.others)}>
          <p className="text-sm font-medium text-ink">{text.otherChannels}</p>
          {links.length > 0 && <div className="flex flex-wrap gap-2">{links.map(ch => channel(ch, false))}</div>}
          {rest.includes("callback") && channel("callback", false)}
        </div>
      )}
    </div>
  );
}
