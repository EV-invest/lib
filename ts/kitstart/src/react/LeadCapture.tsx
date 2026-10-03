"use client";

import { cn } from "@evinvest/uikit";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { resolveChannels, type CaptureChannel } from "../core/channels";
import type { LeadWire } from "../core/lead";
import { fillText, openingText } from "../core/lead-capture-format";
import type { LeadCaptureText } from "../core/lead-capture-text";
import { servedLocalities, storefrontOf, type Place } from "../core/place/types";
import type { FormSelectOption } from "./FormSelect";
import { CallbackForm, ChannelLink, ExperimentFields, type ChannelPart, type Experiment } from "./LeadCaptureChannels";
import { FormMessage, LocalityField, NameField, PhoneField, type FieldPart } from "./LeadCaptureFields";
import { NeedField, type LeadCaptureLayout } from "./LeadCaptureNeed";
import type { PartClassNames } from "./parts";
import { QuoteFormShell } from "./QuoteFormShell";
import { useHydrated, useNeed, useNow, useOpenOnHash } from "./use-lead-context";
import { errorText, formMessageId, OWN_FIELDS, useLeadError } from "./use-lead-error";
import { useLeadEvents } from "./use-lead-events";
import { FailureMessage, SubmitButton } from "./LeadCaptureSubmit";
import { useLeadSubmit, type LeadSent } from "./use-lead-submit";

export type LeadCapturePart =
  | "root" | "head" | "title" | "lede" | "form" | "contact" | "submit" | "trust" | "privacy" | "opening" | "others" | "done"
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
   * `<id>-callback` and its form `<id>-callback-form`. Posted as `card`, so a
   * refused lead comes back here (`?lead_error=<field>#<id>`) and shows why.
   */
  id?: string | undefined;
  text: LeadCaptureText;
  /**
   * `hidden`: every field's label for assistive technology only (`sr-only`) —
   * for a design that draws placeholders instead (`text.*Placeholder`).
   */
  labels?: "visible" | "hidden" | undefined;
  /** Whether the callback starts open; by default only when it is the channel that leads (the place is closed). */
  callbackOpen?: boolean | undefined;
  /**
   * The card once a lead is taken, in place of everything in it. A script
   * posts the form itself either way, so a refusal keeps what was typed and
   * shows why; a lead taken shows this, or — without it — goes to the thanks
   * page. Without a script, or on an answer that is not the route's, the form
   * posts as it always did.
   */
  done?: ReactNode | ((sent: LeadSent) => ReactNode);
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
  const [error, setError] = useLeadError(root, id);
  const { sent, onSubmit, busy, failure, retry } = useLeadSubmit(
    props.done !== undefined,
    { mobile: wire.mobile, name: props.name?.field },
    { onRefused: (channel, field) => setError({ channel, field }), onFailed: (channel, why) => events.submitError(why, channel) },
  );
  // The form's refusal by where it shows: under the field the card draws, else above the submit.
  const formError = error?.channel === "form" ? error.field : null;
  const at = (field: string) => (formError === field ? errorText(field, text) : null);
  const above = formError !== null && !OWN_FIELDS.form.includes(formError) ? errorText(formError, text) : null;
  const doneRef = useRef<HTMLDivElement>(null);
  // The form the focus was in is gone: the news takes it, and is read out.
  useEffect(() => doneRef.current?.focus(), [sent]);
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
  // An arrow key in `qualify-first`: the tile is chosen, the group stays open.
  const select = (value: string) => {
    setNeed(value);
    setEditing(true);
  };

  const channel = (ch: CaptureChannel, primary: boolean) =>
    ch === "callback" ? (
      <CallbackForm
        key={ch}
        id={`${id}-callback`}
        card={id}
        primary={primary}
        open={props.callbackOpen ?? primary}
        formId={formId}
        placeSlug={place.slug}
        locale={locale}
        renderedAt={renderedAt}
        mobileName={wire.mobile}
        subject={need ? { name: wire.subject, value: need } : null}
        opening={opening}
        text={text}
        experiment={experiment}
        onSubmit={onSubmit}
        error={error?.channel === "callback" ? { field: error.field, text: errorText(error.field, text) } : null}
        busy={busy === "callback"}
        failure={failure?.channel === "callback" ? failure.failure : null}
        onRetry={retry}
        onSoftError={() => events.fieldError("phone")}
        classNames={c}
      />
    ) : ch === "form" ? null : (
      <ChannelLink key={ch} channel={ch} contact={contact} message={message} text={text} primary={primary} experiment={experiment} classNames={c} />
    );

  // `qualify-first` shows the contact step as soon as a need's radio is
  // checked (`:has`) — without a script, and inside the tap with one.
  const contactShown = layout === "single" || (need !== undefined && !editing);
  const contactClass = contactShown ? "flex" : "hidden group-has-[[data-need-option]:checked]/lead:flex";

  const rootProps = { id, className: cn("flex w-full flex-col gap-6", props.className, c?.root), "data-experiment": experiment?.name, "data-variant": experiment?.variant };
  if (sent && props.done !== undefined) {
    return (
      <div ref={root} {...rootProps}>
        <div ref={doneRef} role="status" tabIndex={-1} className={cn("outline-none", c?.done)}>
          {typeof props.done === "function" ? props.done(sent) : props.done}
        </div>
      </div>
    );
  }

  return (
    <div ref={root} {...rootProps}>
      {props.head ?? (
        <div className={cn("flex flex-col gap-1", c?.head)}>
          <p className={cn("font-display text-2xl font-bold text-ink", c?.title)}>{text.title}</p>
          <p className={cn("text-ink-soft", c?.lede)}>{text.lede}</p>
        </div>
      )}
      {lead !== "form" && channel(lead, true)}
      <QuoteFormShell
        id={`${id}-form`}
        placeSlug={place.slug}
        locale={locale}
        renderedAt={renderedAt}
        honeypotLabel={text.honeypotLabel}
        formId={formId}
        card={id}
        onSubmit={onSubmit}
        className={cn("group/lead", c?.form)}
      >
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
          requiredText={text.needRequired}
          onPick={pick}
          onSelect={select}
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
            requiredText={text.required}
            error={at("locality")}
            hydrated={hydrated}
            classNames={c}
          />
          <PhoneField name={wire.mobile} text={text} error={at("phone")} onSoftError={() => events.fieldError("phone")} classNames={c} />
          {props.name && (
            <NameField
              name={props.name.field}
              label={text.nameLabel}
              placeholder={text.namePlaceholder}
              required={props.name.required ?? false}
              optional={text.optional}
              requiredText={text.required}
              error={at("name")}
              classNames={c}
            />
          )}
          {props.extras}
          <FormMessage id={formMessageId(id, "form")} error={above} className={c?.error} />
          <FailureMessage failure={failure?.channel === "form" ? failure.failure : null} text={text} onRetry={retry} className={c?.error} />
          <div className={cn("flex flex-col gap-3", c?.trust)}>
            <SubmitButton busy={busy === "form"} label={text.submit} sending={text.sending} className={c?.submit} />
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
