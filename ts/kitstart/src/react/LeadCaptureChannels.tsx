import { Button, buttonVariants, cn } from "@evinvest/uikit";
import { CHANNELS_FIELD, EXPERIMENT_FIELD, VARIANT_FIELD } from "../core/accept";
import { channelHref, type CaptureChannel } from "../core/channels";
import { CHANNEL_FIELD } from "../core/lead";
import { fillText } from "../core/lead-capture-format";
import type { LeadCaptureFlowText, LeadCaptureText } from "../core/lead-capture-text";
import type { FormEventHandler, ReactNode } from "react";
import { ConsentField, FormMessage, PhoneField, type FieldPart } from "./LeadCaptureFields";
import { FailureMessage, SubmitButton } from "./LeadCaptureSubmit";
import type { SendFailure } from "./use-lead-submit";
import { partWithLeading, type PartClassNames } from "./parts";
import { QuoteFormShell } from "./QuoteFormShell";

/**
 * `channel` and `primary` dress every way out, the callback's summary
 * included; the `callback*` parts are the callback's own, after them.
 */
export type ChannelPart = "channel" | "primary" | "callback" | "callbackSummary" | "callbackForm" | "callbackLede" | "callbackSubmit" | "consent" | "photos" | "channelIcon";

/** A way out the brand may draw an icon for (`channelIcons`). */
export type ChannelIconKey = "phone" | "whatsapp" | "sms" | "callback" | "telegram";

/** The brand's icon before a channel's label, hidden from assistive technology: the label names it. */
function ChannelIcon({ icon, className }: { icon: ReactNode; className: string | undefined }) {
  if (icon === undefined || icon === null) return null;
  return (
    <span aria-hidden="true" className={cn("flex shrink-0 items-center [&_svg]:size-5", className)}>
      {icon}
    </span>
  );
}

/**
 * A whole-pixel line under a brand's own type size: tailwind-merge drops a
 * size's line height for nothing, and a 15 px face at the page's 1.5 is a
 * 52.5 px button that puts every band below it off the pixel grid.
 */
const CHANNEL_LEADING = "leading-6";

export interface Experiment {
  name: string;
  variant: string;
}

/** The site's assignment, posted with the form so the submit counts in its arm. */
export function ExperimentFields({ experiment }: { experiment: Experiment | undefined }) {
  if (!experiment) return null;
  return (
    <>
      <input type="hidden" name={EXPERIMENT_FIELD} value={experiment.name} />
      <input type="hidden" name={VARIANT_FIELD} value={experiment.variant} />
    </>
  );
}

/** The links of the channel list; a bot is a `messenger` variant's. */
type LinkChannel = Exclude<CaptureChannel, "form" | "callback" | "telegram">;

const LABEL: Record<LinkChannel, "call" | "whatsapp" | "sms"> = { phone: "call", whatsapp: "whatsapp", sms: "sms" };

/**
 * A channel that leaves the page — `tel:`, `wa.me`, `sms:` — as a link the
 * boundary counts: the tracker reads `tel:` and WhatsApp itself, `data-intent`
 * names the text message it cannot classify. The assignment rides on the link
 * because the tracker reads the link's own `data-*`.
 */
export function ChannelLink(props: {
  channel: LinkChannel;
  contact: { phone: string | null; whatsapp: string | null };
  message: string;
  text: LeadCaptureText;
  primary: boolean;
  experiment: Experiment | undefined;
  icon?: ReactNode;
  classNames?: PartClassNames<ChannelPart> | undefined;
}) {
  const { channel, contact, message, text, primary, experiment, classNames: c } = props;
  const href = channelHref(channel, contact, message);
  if (!href) return null;
  return (
    <Button
      href={href}
      variant={primary ? "primary" : "outline"}
      size="touch"
      className={partWithLeading(primary ? "w-full" : "flex-1", CHANNEL_LEADING, cn(c?.channel, primary && c?.primary) || undefined)}
      data-intent={channel === "sms" ? "sms" : undefined}
      data-experiment={experiment?.name}
      data-variant={experiment?.variant}
    >
      <ChannelIcon icon={props.icon} className={c?.channelIcon} />
      {text[LABEL[channel]]}
    </Button>
  );
}

/**
 * "Call me back": the form cut to a phone number and a consent, posted to the
 * same `/quote` with `channel=callback` — a lead like any other, without a
 * script. A `<details>` so it opens without one too; open from the start when
 * it is the channel that leads (the place is closed), or when the page is
 * opened at its id (`#quote-callback`, the call bar's link). A brand may
 * choose `open` itself; it is still the leading channel's face.
 */
export function CallbackForm(props: {
  id: string;
  /** The card's id, posted so a refusal opens this callback again. */
  card: string;
  /** The channel that leads: the primary face. */
  primary: boolean;
  open: boolean;
  formId: string;
  placeSlug: string | null;
  locale: string;
  renderedAt: number;
  mobileName: string;
  subject: { name: string; value: string } | null;
  opening: string | null;
  text: LeadCaptureText;
  experiment: Experiment | undefined;
  /** The messengers the card offered (`channels_available`), for the submit's event. */
  channels?: string | undefined;
  onSubmit: FormEventHandler<HTMLFormElement> | undefined;
  /** The server's refusal: the field and its words. */
  error: { field: string; text: string } | null;
  /** The script is posting this form. */
  busy: boolean;
  failure: SendFailure | null;
  onRetry: () => void;
  onSoftError: () => void;
  /** In the row of channels (`channelsDisplay="row"`): a button among the others, its form on a line of its own once open. */
  row?: boolean | undefined;
  icon?: ReactNode;
  classNames?: PartClassNames<ChannelPart | FieldPart> | undefined;
}) {
  const { id, primary, open, formId, placeSlug, locale, renderedAt, mobileName, subject, opening, text, experiment, error, classNames: c } = props;
  const at = (field: string) => (error?.field === field ? error.text : null);
  return (
    <details id={id} open={open} className={cn(props.row ? "min-w-0 flex-1 open:basis-full" : "w-full", c?.callback)}>
      {/* A block, not the button's inline-flex: an inline box sits in a line box
          of the details' own, whose strut and baseline add height to the closed
          callback. */}
      <summary
        data-intent="callback"
        className={partWithLeading(
          buttonVariants({ variant: primary ? "primary" : "outline", size: "touch", className: "flex w-full list-none [&::-webkit-details-marker]:hidden" }),
          CHANNEL_LEADING,
          cn(c?.channel, primary && c?.primary, c?.callbackSummary) || undefined,
        )}
      >
        <ChannelIcon icon={props.icon} className={c?.channelIcon} />
        {text.callback}
      </summary>
      <QuoteFormShell
        id={`${id}-form`}
        placeSlug={placeSlug}
        locale={locale}
        renderedAt={renderedAt}
        honeypotLabel={text.honeypotLabel}
        formId={formId}
        card={props.card}
        onSubmit={props.onSubmit}
        className={cn("mt-4 gap-4", c?.callbackForm)}
      >
        <input type="hidden" name={CHANNEL_FIELD} value="callback" />
        {subject && <input type="hidden" name={subject.name} value={subject.value} />}
        <ExperimentFields experiment={experiment} />
        {props.channels && <input type="hidden" name={CHANNELS_FIELD} value={props.channels} />}
        <p className={cn("text-ink-soft", c?.callbackLede)}>{opening ?? text.callbackLede}</p>
        <PhoneField id={`${id}-phone`} name={mobileName} text={text} error={at("phone")} onSoftError={props.onSoftError} classNames={c} />
        <ConsentField sentence={text.callbackConsent} requiredText={text.consentRequired} error={at("consent")} className={c?.consent} classNames={c} />
        <FormMessage id={`${id}-error`} error={error && error.field !== "phone" && error.field !== "consent" ? error.text : null} className={c?.error} />
        <FailureMessage failure={props.failure} text={text} onRetry={props.onRetry} className={c?.error} />
        <SubmitButton busy={props.busy} label={text.callbackSubmit} sending={text.sending} className={c?.callbackSubmit} />
      </QuoteFormShell>
    </details>
  );
}

/**
 * A `quote` need priced from photos (a deep clean, after-works): the photos
 * go by WhatsApp, with the need already said — only when the place has
 * WhatsApp; the callback stays where it is.
 */
export function PhotosAsk(props: {
  whatsapp: string | null;
  needLabel: string;
  text: Pick<LeadCaptureFlowText, "photosTitle" | "photosLede" | "photosCta" | "photosMessage">;
  experiment: Experiment | undefined;
  className?: string | undefined;
}) {
  const { whatsapp, text, experiment } = props;
  const href = whatsapp ? channelHref("whatsapp", { phone: null, whatsapp }, fillText(text.photosMessage, { need: props.needLabel })) : null;
  if (!href) return null;
  return (
    <div className={cn("flex flex-col gap-2 rounded-[var(--control-radius)] border border-border p-4", props.className)}>
      <p className="font-medium text-ink">{text.photosTitle}</p>
      <p className="text-sm text-ink-soft">{text.photosLede}</p>
      <Button href={href} variant="outline" size="touch" className="w-full" data-experiment={experiment?.name} data-variant={experiment?.variant}>
        {text.photosCta}
      </Button>
    </div>
  );
}
