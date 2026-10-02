import { Button, buttonVariants, cn, FieldLabel, Input } from "@evinvest/uikit";
import { EXPERIMENT_FIELD, VARIANT_FIELD } from "../core/accept";
import { channelHref, type CaptureChannel } from "../core/channels";
import { CHANNEL_FIELD, CONSENT_FIELD } from "../core/lead";
import type { LeadCaptureText } from "../core/lead-capture-text";
import type { FieldPart } from "./LeadCaptureFields";
import type { PartClassNames } from "./parts";
import { PHONE_INPUT_PROPS, QuoteFormShell } from "./QuoteFormShell";

export type ChannelPart = "channel" | "primary" | "callback" | "consent";

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

const LABEL: Record<Exclude<CaptureChannel, "form" | "callback">, keyof LeadCaptureText> = { phone: "call", whatsapp: "whatsapp", sms: "sms" };

/**
 * A channel that leaves the page — `tel:`, `wa.me`, `sms:` — as a link the
 * boundary counts: the tracker reads `tel:` and WhatsApp itself, `data-intent`
 * names the text message it cannot classify. The assignment rides on the link
 * because the tracker reads the link's own `data-*`.
 */
export function ChannelLink(props: {
  channel: Exclude<CaptureChannel, "form" | "callback">;
  contact: { phone: string | null; whatsapp: string | null };
  message: string;
  text: LeadCaptureText;
  primary: boolean;
  experiment: Experiment | undefined;
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
      className={cn(primary ? "w-full" : "flex-1", c?.channel, primary && c?.primary)}
      data-intent={channel === "sms" ? "sms" : undefined}
      data-experiment={experiment?.name}
      data-variant={experiment?.variant}
    >
      {text[LABEL[channel]]}
    </Button>
  );
}

/**
 * "Call me back": the form cut to a phone number and a consent, posted to the
 * same `/quote` with `channel=callback` — a lead like any other, without a
 * script. A `<details>` so it opens without one too; open from the start when
 * it is the channel that leads (the place is closed), or when the page is
 * opened at its id (`#quote-callback`, the call bar's link).
 */
export function CallbackForm(props: {
  id: string;
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
  classNames?: PartClassNames<ChannelPart | FieldPart> | undefined;
}) {
  const { id, open, formId, placeSlug, locale, renderedAt, mobileName, subject, opening, text, experiment, classNames: c } = props;
  return (
    <details id={id} open={open} className={cn("w-full", c?.callback)}>
      <summary
        data-intent="callback"
        className={buttonVariants({ variant: open ? "primary" : "outline", size: "touch", className: cn("w-full list-none [&::-webkit-details-marker]:hidden", c?.channel, open && c?.primary) })}
      >
        {text.callback}
      </summary>
      <QuoteFormShell id={`${id}-form`} placeSlug={placeSlug} locale={locale} renderedAt={renderedAt} honeypotLabel={text.honeypotLabel} formId={formId} className="mt-4 gap-4">
        <input type="hidden" name={CHANNEL_FIELD} value="callback" />
        {subject && <input type="hidden" name={subject.name} value={subject.value} />}
        <ExperimentFields experiment={experiment} />
        <p className="text-ink-soft">{opening ?? text.callbackLede}</p>
        <div className={cn("flex flex-col gap-2", c?.field)}>
          <FieldLabel htmlFor={`${id}-phone`} className={c?.label}>
            {text.phoneLabel}
          </FieldLabel>
          <Input
            id={`${id}-phone`}
            name={mobileName}
            size="lg"
            {...PHONE_INPUT_PROPS}
            enterKeyHint="send"
            placeholder={text.phonePlaceholder}
            required
            data-lead-field="phone"
            className={c?.control}
          />
        </div>
        <label className={cn("flex min-h-11 items-start gap-3 text-sm text-ink", c?.consent)}>
          {/* Native, so `required` holds without a script (the kit's checkbox is a
              button); its value is the sentence beside it, which the lead keeps. */}
          <input type="checkbox" name={CONSENT_FIELD} value={text.callbackConsent} required data-lead-field="consent" className="mt-0.5 size-5 shrink-0 accent-primary" />
          <span>{text.callbackConsent}</span>
        </label>
        <Button type="submit" size="touch" className="w-full">
          {text.callbackSubmit}
        </Button>
      </QuoteFormShell>
    </details>
  );
}
