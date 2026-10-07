"use client";

import { Button, cn } from "@evinvest/uikit";
import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CHANNELS_FIELD, PRICE_CHANGED, SHOWN_CENTS_FIELD } from "../core/accept";
import { resolveChannels, type CaptureChannel } from "../core/channels";
import { CHANNEL_FIELD, leadErrorFor, type LeadError, type LeadWire, type PageLeadError } from "../core/lead";
import { fillText, formatCents, openingText } from "../core/lead-capture-format";
import { channelsAvailable, MESSAGE_REF_FIELD, type MessengerFacts, type MessengerVariant } from "../core/messenger";
import { flowTextOf, type LeadCaptureText } from "../core/lead-capture-text";
import { bookingOf } from "../core/booking/model";
import { servedLocalities, storefrontOf, type Place } from "../core/place/types";
import { ESTIMATE_UNKNOWN, estimateField, flowOf, type LeadFlows } from "../core/pricing/flow";
import type { PricingInput, PricingModel } from "../core/pricing/model";
import { labelOf } from "../core/pricing/validate";
import type { BookingAdapters } from "./booking-adapters";
import { focusNext } from "./focus-next";
import { LeadBooking } from "./LeadBooking";
import type { BookingPart } from "./LeadBookingManual";
import { LeadCapturePriced, type PricedPart } from "./LeadCapturePriced";
import { CallbackForm, ChannelLink, ExperimentFields, PhotosAsk, type ChannelIconKey, type ChannelPart, type Experiment } from "./LeadCaptureChannels";
import { askedInputs, EstimateInputs, EstimateQuestionField, estimatePlan, screensOf, useEstimate, type EstimatePart, type EstimateQuestions } from "./LeadCaptureEstimate";
import { ConsentField, FormMessage, LocalityField, NameField, PhoneField, type FieldPart } from "./LeadCaptureFields";
import { NeedField, type LeadCaptureLayout, type LeadNeedDisplay, type LeadNeedOption } from "./LeadCaptureNeed";
import { PriceBox, PriceCompact, type PricePart } from "./LeadCapturePrice";
import { IntroField, LeadSteps, type StepsPart, type StepView } from "./LeadCaptureSteps";
import { drawsAt, initialMode, MessengerSlot, messengerShownOf, NO_MESSENGERS, useMessageRef } from "./LeadCaptureMessenger";
import type { MessengerAt, MessengerKit, MessengerPart, PhoneOptions } from "./messenger/types";
import { stepOfField, stepsOf, useLeadSteps, type LeadIntro, type StepId } from "./lead-steps";
import type { PartClassNames } from "./parts";
import { QuoteFormShell } from "./QuoteFormShell";
import { useHeld, useHydrated, useNeed, useNow, useOpenOnHash, usePostcode } from "./use-lead-context";
import { errorText, formMessageId, OWN_FIELDS, useLeadError } from "./use-lead-error";
import { useLeadEvents } from "./use-lead-events";
import { useLeadFocus } from "./use-lead-focus";
import { FailureMessage, SubmitButton } from "./LeadCaptureSubmit";
import { useLeadSubmit, type LeadSent } from "./use-lead-submit";
import { useRepriced } from "./use-repriced";

export type LeadCapturePart =
  | "root" | "head" | "title" | "lede" | "form" | "contact" | "submit" | "trust" | "privacy" | "opening" | "others" | "done"
  | "needs" | "need" | "summary" | "icon" | "intro" | "introOption" | "stepNext"
  | FieldPart | ChannelPart | EstimatePart | PricePart | StepsPart | PricedPart | BookingPart | MessengerPart;

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
  /** The brand's subjects with their labels, in order — and an icon each for `needDisplay="cards"`. */
  needs: readonly LeadNeedOption[];
  /**
   * How each need is sold — `site.lead.flows`, the map the server prices
   * with. A need runs `estimate` or `fixed` only when `pricing` prices it so
   * (`flowOf`); otherwise, and without the two, every need is a `quote`.
   */
  flows?: LeadFlows | undefined;
  /**
   * The price list the page priced from — `createPricingSource(site).model()`
   * on the server page, handed down as data. An estimate's price is computed
   * here as the visitor answers, and again by the route, whose number is kept.
   */
  pricing?: PricingModel | null | undefined;
  /**
   * `quote` needs a price is given from photos (a deep clean, after-works):
   * a WhatsApp link to send them, prefilled with the need, when the place
   * has WhatsApp. The callback is offered as always.
   */
  photos?: readonly string[] | undefined;
  /**
   * After a priced lead: how the slot is set. By default the place's booking
   * (`place.booking`, `manual` when it has none) for `bookingVariant`,
   * through its provider's adapter — `LeadBooking`. A node here replaces it
   * whole.
   */
  booking?: ReactNode | ((sent: LeadSent) => ReactNode);
  /**
   * The built-in booking adapters with the brand's own over them, by
   * provider — from a client component only: a server one cannot pass functions.
   */
  bookingAdapters?: BookingAdapters | undefined;
  /**
   * The variant of the `booking_provider` experiment (`BOOKING_EXPERIMENT`):
   * the provider this visitor is offered, when the place has it; else the
   * place's default (`bookingOf`).
   */
  bookingVariant?: string | null | undefined;
  /** The providers' embeds instead of a new tab — only once the visitor accepted their cookies. */
  bookingEmbed?: boolean | undefined;
  /** The need the page already knows; `?need=` and `[data-need]` triggers set it too. */
  need?: string | undefined;
  /**
   * `single` (one screen, the default) · `steps` (one question per screen, a
   * thin bar, a way back, the phone last) · `qualify-first` (the two screens
   * `steps` grew from: the need, then the contact) — an experiment's switch.
   */
  layout?: LeadCaptureLayout | undefined;
  /** How the need is asked: `select` (default on one screen), `tiles` (default otherwise), `cards` with the `icon` of each need. */
  needDisplay?: LeadNeedDisplay | undefined;
  /**
   * `steps` only: a question before the need whose answer is posted as one of
   * the brand's extras (`field`) and may change the channel — `callback`:
   * the rest is the phone and its consent, posted as a callback.
   */
  intro?: LeadIntro | undefined;
  /** `steps` only: the postcode on a screen of its own (default), or on the phone's. */
  localityStep?: "own" | "with-phone" | undefined;
  /**
   * After a choice (the need, an estimate's answer) the focus moves to the
   * next empty field, and Enter in a field moves to the next empty one before
   * it submits. Always so in `steps`; off by default on one screen.
   */
  focusNext?: boolean | undefined;
  /** By estimate input id: how a question is asked — `cards` with the total each answer makes, an "I don't know", badges. */
  questions?: EstimateQuestions | undefined;
  /** `box` (default): the price box. `compact`: one line, a tax-credit line with `taxCredit`, the breakdown behind "Détail". */
  price?: "box" | "compact" | undefined;
  /** `price="compact"`: the share of the price a tax credit gives back (0.5 for half), shown as what is left to pay. */
  taxCredit?: number | undefined;
  locality?: "required" | "optional" | undefined;
  /** A name field, posted as the brand's extra `field`. Off by default: every field costs leads. */
  name?: { field: string; required?: boolean } | undefined;
  /** The brand's extra fields, after the phone — never before it. */
  extras?: ReactNode;
  /** Right under the phone field: one short line of reassurance ("Votre numéro reste entre nous"). */
  afterPhone?: ReactNode;
  /** The other ways out: `stack` (default), under a heading, or `row`, one row of compact buttons. */
  channelsDisplay?: "stack" | "row" | undefined;
  /** The brand's icon before a channel's label, by channel. */
  channelIcons?: Partial<Record<ChannelIconKey, ReactNode>> | undefined;
  /** Moved first when available — a `default_channel` experiment's arm. */
  prefer?: CaptureChannel | undefined;
  /**
   * The `lead_channel` experiment's arm: how the card offers WhatsApp and the
   * brand's bot (`MessengerVariant`); absent → the control. A place without
   * WhatsApp falls back to the control (`messengerShownOf`), and every event
   * says which messengers were there (`channels_available`).
   */
  messenger?: MessengerVariant | undefined;
  /** `messengerFacts(site, place)`: the place's own WhatsApp number and bot, each `null` when off. */
  messengers?: MessengerFacts | undefined;
  /** The brand's prefix of the lead's chat reference (`AQ` → `AQ-7K3F`, `message_ref`); without it no reference. */
  refPrefix?: string | undefined;
  /** The brand's name: the prefilled message's greeting («Bonjour Aquafix»). */
  brand?: string | undefined;
  /**
   * The estimate's question whose answer is the message's timing line and
   * in its preview (`{ input: "frequency" }` → «Délai souhaité : 2 sem.»);
   * nothing until it is answered, nor for «I don't know».
   */
  messengerTiming?: { input: string } | undefined;
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
  /**
   * The refusal the page read from its query — `leadErrorOf(searchParams)` —
   * drawn on the server, so the card says why without a script — by this card
   * only when the query names it (`lead_card`, `leadErrorFor`). A page built
   * for ISR has no query to read; there the script says it once it runs.
   */
  initialError?: PageLeadError | LeadError | null | undefined;
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
  const steps = layout === "steps";
  const needDisplay = props.needDisplay ?? (layout === "single" ? "select" : "tiles");
  // Enter on a tile answers it wherever an answer moves the visitor on.
  const enterPicks = layout !== "single" || props.focusNext === true;
  const root = useRef<HTMLDivElement>(null);
  const formRef = () => root.current?.querySelector<HTMLFormElement>(`#${CSS.escape(`${id}-form`)}`) ?? null;
  const hydrated = useHydrated();
  const [editing, setEditing] = useState(false);
  const [need, setNeed] = useNeed(props.need, needs.map(n => n.value), () => setEditing(false));
  const [introValue, setIntro] = useState<string | undefined>(undefined);
  const intro = steps ? props.intro : undefined;
  const callbackPreset = intro?.options.find(o => o.value === introValue)?.channel === "callback";
  const served = localitySuggestions(place);
  const postcode = usePostcode();
  const [locality, setLocality] = useState<string | undefined>(undefined);
  const localityShown = locality ?? postcode ?? (served.length === 1 ? served[0] : undefined);
  const facts = props.messengers ?? NO_MESSENGERS;
  const shown = messengerShownOf(props.messenger, facts);
  const channels = channelsAvailable(props.messengers);
  const [mode, setMode] = useState(() => initialMode(props.messenger));
  const { ref: messageRef, renew: renewRef, minted } = useMessageRef(props.refPrefix, shown !== null);
  const events = useLeadEvents(root, { formId, layout, experiment, channels, messenger: shown ?? undefined });
  useOpenOnHash(`${id}-callback`);
  // Only this card's: a page may draw several, and the query names one.
  const initial = leadErrorFor(props.initialError ?? null, id);
  const [error, setError] = useLeadError(root, id, initial);
  const flowText = flowTextOf(text, locale);
  // `single` shows its select at the first need until one is picked: that is the need on screen.
  const shownNeed = need ?? (layout === "single" && needDisplay === "select" ? needs[0]?.value : undefined);
  const model = props.pricing ?? null;
  const wanted = flowOf(props.flows, model, shownNeed);
  const estimate = useEstimate(model, shownNeed, wanted, events.estimateShown);
  const flow = estimate.flow;
  const repriced = useRepriced(estimate.price, shownNeed, flowText, locale);
  // A priced lead stays in the card: its price is confirmed there, and the slot promised.
  // `thanks` offers its messengers in the success: the card stays.
  const staysInCard = (ch: "form" | "callback") => props.done !== undefined || (ch === "form" && (flow !== "quote" || shown === "thanks"));
  const { sent, onSubmit, busy, failure, retry } = useLeadSubmit(
    staysInCard,
    { mobile: wire.mobile, name: props.name?.field },
    {
      onRefused: (channel, field, cents) => {
        repriced.refused(field, cents);
        // The intro's callback is this form's: its refusal shows here, not in the folded callback.
        setError({ channel: callbackPreset ? "form" : channel, field });
      },
      onFailed: (channel, why) => events.submitError(why, channel),
    },
  );
  // The form's refusal by where it shows: under the field the card draws, else above the submit.
  const formError = error?.channel === "form" ? error.field : null;
  const at = (field: string) => (formError === field ? errorText(field, text) : null);
  const drawn = (field: string) => OWN_FIELDS.form.includes(field) || (callbackPreset && field === "consent");
  const above = formError === PRICE_CHANGED ? repriced.message() : formError !== null && !drawn(formError) ? errorText(formError, text) : null;
  const doneRef = useRef<HTMLDivElement>(null);
  // The form the focus was in is gone: the news takes it, and is read out.
  useEffect(() => doneRef.current?.focus(), [sent]);
  // Held while a lead is posting or failed: its form stays where it is, for the retry.
  const now = useHeld(useNow(renderedAt), busy !== null || failure !== null);
  const resolved = resolveChannels({ ...contact, hours: place.hours }, { now: new Date(now), timeZone: props.timeZone, prefer: props.prefer });
  const opening = openingText(resolved.nextOpening, text, locale);
  const needLabel = needs.find(n => n.value === need)?.label;
  const message = needLabel ? fillText(text.message, { need: needLabel }) : text.messageGeneric;
  const [lead = "form", ...rest] = resolved.order;
  // A variant owns WhatsApp — its link posts the lead first — and the owner's model has no text message.
  const owned = (ch: CaptureChannel) => shown !== null && shown !== "fallback" && (ch === "whatsapp" || ch === "sms");
  const links = rest.filter((ch): ch is "phone" | "whatsapp" | "sms" => ch !== "form" && ch !== "callback" && ch !== "telegram" && !owned(ch));
  // The intro asked for a call back: the folded callback would be a second one.
  const callbackElsewhere = !callbackPreset;

  const asked = model && shownNeed !== undefined && wanted === "estimate" ? askedInputs(model, shownNeed, estimate.answers) : [];
  const screens = screensOf(asked.map(i => i.id), props.questions);
  const stepIds = steps ? stepsOf({ intro: intro !== undefined, callback: callbackPreset, estimate: screens, localityOwn: props.localityStep !== "with-phone" }) : [];
  const screenOf = (step: StepId) => screens.find(screen => screen[0] !== undefined && estimateField(screen[0]) === step) ?? [];
  // The bar counts the most screens an answer to come could add — the need's
  // longest estimate — so it never moves back; until the intro picks its branch, no total is said.
  const longest = Math.max(0, ...needs.map(n => (model && flowOf(props.flows, model, n.value) === "estimate" ? screensOf(estimatePlan(model, n.value), props.questions).length : 0)));
  const total = intro !== undefined && introValue === undefined ? null : stepIds.length + (need === undefined && !callbackPreset ? longest : 0);
  const answered = (step: StepId) =>
    step === "intro" ? introValue !== undefined : step === "need" ? need !== undefined : step === "locality" ? localityShown !== undefined : step === "phone" ? false : screenOf(step).every(id => estimate.answers[id] !== undefined);
  const stepper = useLeadSteps(stepIds, answered, steps && formError !== null ? stepOfField(stepIds, formError, screens) : null, events.step);
  const { moveOn, focusAfterSelect } = useLeadFocus(formRef, { steps, focusNext: props.focusNext === true, current: stepper.current });

  const pick = (value: string, from: HTMLElement | null) => {
    // A need that brings an estimate's questions brings screens React has yet to draw.
    const brings = flowOf(props.flows, model, value) === "estimate";
    if (steps) return moveOn(() => (setNeed(value), stepper.next()), from, !brings && asked.length === 0);
    if (layout === "single") {
      if (from === null) {
        setNeed(value);
        setEditing(true);
        focusAfterSelect();
        return;
      }
      return moveOn(() => (setNeed(value), setEditing(true)), from, !brings && asked.length === 0);
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
  // An arrow key among the tiles: the tile is chosen, the group stays open.
  const select = (value: string) => {
    setNeed(value);
    setEditing(true);
  };
  // "I don't know", or an answer instead of it, changes which questions are asked.
  // On a screen shared by a few questions, the last one answered moves on; until then the screen stays.
  const answerPicked = (input: string, option: string, radio: HTMLInputElement) => {
    const screen = steps ? screenOf(stepper.current) : [];
    const complete = screen.every(id => id === input || option === ESTIMATE_UNKNOWN || estimate.answers[id] !== undefined);
    moveOn(() => (estimate.answer(input, option), steps && (complete ? stepper.next() : stepper.edit(stepper.current))), radio, option !== ESTIMATE_UNKNOWN && estimate.answers[input] !== ESTIMATE_UNKNOWN);
  };
  /** A shared screen's button: on when every question is answered, else the first one unanswered says so. */
  const continueScreen = (screen: readonly string[]) => {
    const missing = screen.find(id => estimate.answers[id] === undefined);
    const radio = missing === undefined ? null : formRef()?.querySelector<HTMLInputElement>(`input[name="${estimateField(missing)}"]`);
    if (radio) return void radio.reportValidity();
    moveOn(stepper.next, null, false);
  };
  const continueLocality = () => {
    const el = formRef()?.querySelector<HTMLInputElement>('[data-lead-step="locality"] [data-lead-field="locality"]');
    if (!el?.reportValidity()) return;
    moveOn(() => (setLocality(el.value.trim()), stepper.next()), el, true);
  };
  // Enter in a typed field: the next empty field, or the next screen, before the submit.
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    const field = e.target;
    if (e.key !== "Enter" || !(steps || props.focusNext) || !(field instanceof HTMLInputElement) || ["radio", "checkbox", "submit", "button"].includes(field.type)) return;
    if (focusNext(e.currentTarget, field)) e.preventDefault();
    else if (steps && stepper.current === "locality") {
      e.preventDefault();
      continueLocality();
    }
  };

  const channel = (ch: CaptureChannel, primary: boolean) =>
    ch === "callback" ? (
      <CallbackForm
        key={ch}
        id={`${id}-callback`}
        card={id}
        primary={primary}
        open={initial?.channel === "callback" || (props.callbackOpen ?? primary)}
        formId={formId}
        placeSlug={place.slug}
        locale={locale}
        renderedAt={renderedAt}
        mobileName={wire.mobile}
        subject={need ? { name: wire.subject, value: need } : null}
        opening={opening}
        text={text}
        experiment={experiment}
        channels={channels}
        onSubmit={onSubmit}
        error={error?.channel === "callback" ? { field: error.field, text: errorText(error.field, text) } : null}
        busy={busy === "callback"}
        failure={failure?.channel === "callback" ? failure.failure : null}
        onRetry={retry}
        onSoftError={() => events.fieldError("phone")}
        row={!primary && props.channelsDisplay === "row"}
        icon={props.channelIcons?.callback}
        classNames={c}
      />
    ) : ch === "form" || ch === "telegram" ? null : (
      <ChannelLink key={ch} channel={ch} contact={contact} message={message} text={text} primary={primary} experiment={experiment} icon={props.channelIcons?.[ch]} classNames={c} />
    );

  // The estimate's answers as the message says them: the whole label, and the
  // brand's short one (`questions[id].shortLabels`) for the preview. «I don't
  // know» is no answer; the timing question has a line of its own.
  const answerOf = (input: PricingInput): { label: string; short: string } | null => {
    const option = input.options.find(o => o.id === estimate.answers[input.id]);
    if (!option) return null;
    const label = labelOf(option.labels, locale);
    return { label, short: props.questions?.[input.id]?.shortLabels?.[option.id] ?? label };
  };
  const timingInput = asked.find(i => i.id === props.messengerTiming?.input);
  const answerShorts = asked
    .filter(i => i !== timingInput)
    .map(i => answerOf(i)?.short)
    .filter((short): short is string => short !== undefined);
  // A variant arranges the card's own phone field and submit; it never draws its own.
  const kitOf = (at: MessengerAt, variant: MessengerVariant, drawn: NonNullable<typeof shown>): MessengerKit => ({
    at,
    variant,
    shown: drawn,
    facts,
    id,
    locale,
    brand: props.brand ?? "",
    text,
    wire,
    needs,
    needLabel: needs.find(n => n.value === shownNeed)?.label ?? null,
    priceText: flow !== "quote" && repriced.price ? formatCents(repriced.price.cents, locale) : null,
    answers: answerShorts,
    timing: timingInput ? answerOf(timingInput) : null,
    mode,
    setMode,
    messageRef,
    renewRef,
    ready: minted,
    phone: options => phoneOf(options),
    // Inside a variant the submit is its main button, dressed as its messenger's.
    // …with the phone's icon before its words: it is the call.
    submit: (label, options) =>
      submitOf(label, { ...options, className: cn(c?.messengerCta, options?.className), icon: props.channelIcons?.phone ?? props.channelIcons?.callback }),
    title: text.title,
    lede: text.lede,
    events,
    icons: props.channelIcons,
    experiment,
    classNames: c,
  });
  const slot = (at: MessengerAt) => shown !== null && props.messenger && drawsAt(shown, at) && <MessengerSlot key={`messenger-${at}`} kit={kitOf(at, props.messenger, shown)} />;
  const rootProps = {
    id,
    className: cn("flex w-full flex-col gap-6", props.className, c?.root),
    "data-experiment": experiment?.name,
    "data-variant": experiment?.variant,
    "data-channels-available": channels,
  };
  if (sent && staysInCard(sent.channel)) {
    const done = typeof props.done === "function" ? props.done(sent) : props.done;
    return (
      <div ref={root} {...rootProps}>
        <div ref={doneRef} role="status" tabIndex={-1} className={cn("flex flex-col gap-4 outline-none", c?.done)}>
          <Fragment key="done">{done}</Fragment>
          {sent.channel === "form" && flow !== "quote" && (
            <LeadCapturePriced
              sent={sent}
              booking={
                props.booking === undefined ? (
                  <LeadBooking booking={bookingOf(place, props.bookingVariant)} sent={sent} locale={locale} text={flowText} adapters={props.bookingAdapters} embed={props.bookingEmbed} formId={formId} classNames={c} />
                ) : typeof props.booking === "function" ? (
                  props.booking(sent)
                ) : (
                  props.booking
                )
              }
              locale={locale}
              text={flowText}
              classNames={c}
            />
          )}
          {sent.channel === "form" && slot("done")}
        </div>
      </div>
    );
  }

  // An arrow key in `steps`: chosen, and the screen stays on until the answer is given.
  const stay = <A extends unknown[]>(choose: (...args: A) => void) => (...args: A) => {
    if (steps) stepper.edit(stepper.current);
    choose(...args);
  };
  const estimateProps = { locale, answers: estimate.answers, unknownLabel: flowText.estimateUnknown, required: hydrated, enterPicks, onPick: answerPicked, onSelect: stay(estimate.answer), classNames: c };
  const priceShown = model && flow !== "quote" && (
    props.price === "compact" ? (
      <PriceCompact model={model} flow={flow} price={repriced.price} locale={locale} taxCredit={props.taxCredit} text={flowText} classNames={c} />
    ) : (
      <PriceBox model={model} flow={flow} price={repriced.price} locale={locale} text={flowText} classNames={c} />
    )
  );
  const photos = flow === "quote" && shownNeed !== undefined && props.photos?.includes(shownNeed) && !callbackPreset && (
    <PhotosAsk whatsapp={contact.whatsapp} needLabel={needs.find(n => n.value === shownNeed)?.label ?? shownNeed} text={flowText} experiment={experiment} className={c?.photos} />
  );
  const localityField = (
    <LocalityField
      // Remounted with what the query knew: an untouched field takes it as typed.
      key={postcode ?? ""}
      name={wire.locality}
      label={text.localityLabel}
      servedLabel={text.servedLabel}
      served={served}
      placeholder={text.localityPlaceholder}
      required={props.locality !== "optional"}
      optional={text.optional}
      requiredText={text.required}
      error={at("locality")}
      hydrated={hydrated}
      preset={postcode}
      classNames={c}
    />
  );
  function phoneOf(o: PhoneOptions = {}) {
    return (
      <>
        <PhoneField
          name={wire.mobile}
          text={text}
          error={at("phone")}
          onSoftError={() => events.fieldError("phone")}
          optional={o.optional}
          disabled={o.disabled}
          placeholder={o.placeholder}
          frame={o.frame}
          form={o.form}
          classNames={c}
        />
        <Fragment key="afterPhone">{"after" in o ? o.after : props.afterPhone}</Fragment>
      </>
    );
  }
  // A variant's `contact` takes the phone's place, and brings its own button.
  const contactSlot = slot("contact");
  const phone = contactSlot || phoneOf();
  const nameField = props.name && (
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
  );
  const mainBusy = busy === "form" || (callbackPreset && busy === "callback");
  const mainFailure = failure && (failure.channel === "form" || callbackPreset) ? failure.failure : null;
  function submitOf(label?: string, o: { form?: string; className?: string; icon?: ReactNode } = {}) {
    return (
      <SubmitButton
        busy={mainBusy}
        label={label ?? (callbackPreset ? text.callbackSubmit : flow === "quote" ? text.submit : flowText.bookSubmit)}
        sending={text.sending}
        form={o.form}
        className={cn(callbackPreset ? cn(c?.submit, c?.callbackSubmit) : c?.submit, o.className)}
      >
        {o.icon !== undefined && o.icon !== null && (
          <span aria-hidden="true" className={cn("flex shrink-0 items-center [&_svg]:size-5", c?.channelIcon)}>
            {o.icon}
          </span>
        )}
      </SubmitButton>
    );
  }
  /**
   * Without a script a variant leads nowhere — its messenger links are inert
   * until the reference is minted — so a browser that runs none gets the
   * control's phone and submit (`select` draws the phone already). Never
   * parsed where scripts run.
   */
  function noScript() {
    return (
      <noscript>
        {shown !== "select" && phoneOf({ after: null })}
        {submitOf()}
      </noscript>
    );
  }
  const tail = (
    <>
      <FormMessage id={formMessageId(id, "form")} error={above} className={c?.error} />
      <FailureMessage failure={mainFailure} text={text} onRetry={retry} className={c?.error} />
      <div className={cn("flex flex-col gap-3", c?.trust)}>
        {!contactSlot && submitOf()}
        {contactSlot && noScript()}
        {slot("afterSubmit")}
        <Fragment key="trust">{props.trust}</Fragment>
      </div>
      {opening && lead !== "callback" && <p className={cn("text-sm text-ink-soft", c?.opening)}>{opening}</p>}
      {text.privacy !== "" && <p className={cn("text-sm text-ink-soft", c?.privacy)}>{text.privacy}</p>}
    </>
  );

  // `qualify-first` shows the contact step as soon as a need's radio is
  // checked (`:has`) — without a script, and inside the tap with one.
  const contactShown = layout === "single" || (need !== undefined && !editing);
  const contactClass = contactShown ? "flex" : "hidden group-has-[[data-need-option]:checked]/lead:flex";

  const stepView = (step: StepId): StepView => {
    switch (step) {
      case "intro": {
        const chosen = intro?.options.find(o => o.value === introValue);
        return {
          id: step,
          label: intro?.label ?? "",
          value: chosen?.label ?? null,
          node: intro && (
            <IntroField
              intro={intro}
              value={introValue}
              onPick={(v, radio) => moveOn(() => (setIntro(v), stepper.next()), radio, false)}
              onSelect={stay(setIntro)}
              // On a screen of its own, a question is its heading: never only for assistive technology.
              classNames={props.classNames}
            />
          ),
        };
      }
      case "need":
        return {
          id: step,
          label: text.needLabel,
          value: needLabel ?? null,
          node: (
            <NeedField
              display={needDisplay === "select" ? "tiles" : needDisplay}
              name={wire.subject}
              needs={needs}
              need={need}
              editing
              hydrated={hydrated}
              label={text.needLabel}
              changeLabel={text.needChange}
              requiredText={text.needRequired}
              enterPicks
              onPick={pick}
              onSelect={stay(setNeed)}
              onEdit={() => undefined}
              classNames={props.classNames}
            />
          ),
        };
      case "locality":
        return {
          id: step,
          label: text.localityLabel,
          value: localityShown ?? null,
          node: (
            <>
              {localityField}
              <Button type="button" size="touch" data-lead-chrome="" className={cn("w-full", c?.stepNext)} onClick={continueLocality}>
                {flowText.stepNext}
              </Button>
            </>
          ),
        };
      case "phone":
        return {
          id: step,
          label: text.phoneLabel,
          value: null,
          node: callbackPreset ? (
            <>
              <input type="hidden" name={CHANNEL_FIELD} value="callback" />
              {phone}
              <ConsentField sentence={text.callbackConsent} requiredText={text.consentRequired} error={at("consent")} className={c?.consent} classNames={c} />
              {tail}
            </>
          ) : (
            <>
              {priceShown}
              {photos}
              {props.localityStep === "with-phone" && localityField}
              {phone}
              {nameField}
              <Fragment key="extras">{props.extras}</Fragment>
              {tail}
            </>
          ),
        };
      default: {
        const inputs = screenOf(step).flatMap(id => asked.filter(i => i.id === id));
        const answerOf = (input: PricingInput) => {
          const answer = estimate.answers[input.id];
          const option = input.options.find(o => o.id === answer);
          return answer === ESTIMATE_UNKNOWN ? flowText.estimateUnknown : option ? labelOf(option.labels, locale) : null;
        };
        const values = inputs.map(answerOf);
        const first = inputs[0];
        return {
          id: step,
          label: inputs.map(i => labelOf(i.labels, locale)).join(" · "),
          value: values.length > 0 && values.every(v => v !== null) ? values.join(" · ") : null,
          node: model && shownNeed !== undefined && first && (
            <>
              {inputs.map(input => (
                <EstimateQuestionField key={input.id} model={model} need={shownNeed} input={input} question={props.questions?.[input.id]} {...estimateProps} />
              ))}
              {inputs.length > 1 && (
                <Button type="button" size="touch" data-lead-chrome="" className={cn("w-full", c?.stepNext)} onClick={() => continueScreen(inputs.map(i => i.id))}>
                  {props.questions?.[first.id]?.next ?? flowText.stepNext}
                </Button>
              )}
            </>
          ),
        };
      }
    }
  };

  return (
    <div ref={root} {...rootProps}>
      {/*
        A brand's slot, built in a server component, can reach this client
        island as a lazy reference React resolves only here, unseen by the JSX
        that placed it: bare among siblings it is a list child with no key, and
        React dev warns. Each slot sits alone in a keyed fragment instead.
      */}
      <Fragment key="head">
        {slot("head") ||
          (props.head ?? (
            <div className={cn("flex flex-col gap-1", c?.head)}>
              <p className={cn("font-display text-2xl font-bold text-ink", c?.title)}>{text.title}</p>
              {/* `chip` says it in place of the lede. */}
              {!drawsAt(shown, "afterHead") && <p className={cn("text-ink-soft", c?.lede)}>{text.lede}</p>}
            </div>
          ))}
      </Fragment>
      {slot("afterHead")}
      {lead !== "form" && !owned(lead) && (lead !== "callback" || callbackElsewhere) && channel(lead, true)}
      <QuoteFormShell
        id={`${id}-form`}
        placeSlug={place.slug}
        locale={locale}
        renderedAt={renderedAt}
        honeypotLabel={text.honeypotLabel}
        formId={formId}
        card={id}
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
        data={steps ? { "data-lead-steps": "" } : undefined}
        className={cn("group/lead", c?.form)}
      >
        <ExperimentFields experiment={experiment} />
        <input type="hidden" name={CHANNELS_FIELD} value={channels} />
        {messageRef && <input type="hidden" name={MESSAGE_REF_FIELD} value={messageRef} />}
        {/* Compared by the server, never stored: a lead is taken at the price it was shown. */}
        {flow !== "quote" && repriced.shownCents !== undefined && <input type="hidden" name={SHOWN_CENTS_FIELD} value={repriced.shownCents} />}
        {steps ? (
          <LeadSteps
            steps={stepIds.map(stepView)}
            current={stepper.current}
            total={total}
            onBack={() => moveOn(stepper.back, null, false)}
            onEdit={step => moveOn(() => stepper.edit(step), null, false)}
            text={{ stepProgress: flowText.stepProgress, stepProgressOpen: flowText.stepProgressOpen, stepBack: flowText.stepBack, change: text.needChange }}
            classNames={c}
          />
        ) : drawsAt(shown, "body") && mode === null ? (
          // `saga`'s first screen: the channel, before anything else.
          <>
            {slot("body")}
            {noScript()}
          </>
        ) : (
          <>
            {slot("beforeNeed")}
            <NeedField
              display={needDisplay}
              name={wire.subject}
              needs={needs}
              need={need}
              editing={editing}
              hydrated={hydrated}
              label={text.needLabel}
              changeLabel={text.needChange}
              requiredText={text.needRequired}
              enterPicks={enterPicks}
              onPick={pick}
              onSelect={select}
              onEdit={() => {
                setEditing(true);
                events.step("need");
              }}
              classNames={c}
            />
            <div className={cn("flex-col gap-5", contactClass, c?.contact)}>
              {model && shownNeed !== undefined && wanted === "estimate" && <EstimateInputs model={model} need={shownNeed} questions={props.questions} {...estimateProps} />}
              {priceShown}
              {photos}
              {localityField}
              {phone}
              {nameField}
              <Fragment key="extras">{props.extras}</Fragment>
              {tail}
            </div>
          </>
        )}
      </QuoteFormShell>
      {(links.length > 0 || (rest.includes("callback") && callbackElsewhere)) &&
        (props.channelsDisplay === "row" ? (
          <div role="group" aria-label={text.otherChannels} className={cn("flex flex-row flex-wrap gap-2", c?.others)}>
            {links.map(ch => channel(ch, false))}
            {rest.includes("callback") && callbackElsewhere && channel("callback", false)}
          </div>
        ) : (
          <div className={cn("flex flex-col gap-3", c?.others)}>
            <p className="text-sm font-medium text-ink">{text.otherChannels}</p>
            {links.length > 0 && <div className="flex flex-wrap gap-2">{links.map(ch => channel(ch, false))}</div>}
            {rest.includes("callback") && callbackElsewhere && channel("callback", false)}
          </div>
        ))}
    </div>
  );
}
