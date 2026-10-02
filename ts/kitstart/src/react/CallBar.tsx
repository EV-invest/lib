import { telHref, whatsappHref } from "@evinvest/marketing";
import { Button, cn } from "@evinvest/uikit";
import { resolveChannels, type CaptureChannel } from "../core/channels";
import type { CallBarText, CopySlice } from "../core/content";
import type { OpeningHours } from "../core/place/types";
import type { PartClassNames } from "./parts";

export type CallBarPart = "call" | "whatsapp" | "quote" | "callback";

/**
 * Pinned to the bottom, mobile only. The header scrolls away with the hero,
 * so without this there is no contact channel on a phone between the hero and
 * the closing band. `sticky`, not `fixed`: it is the last thing in the flow,
 * so it reserves its own height instead of the page guessing it back.
 *
 * The form and WhatsApp lead; the phone keeps a square of its own. A channel
 * the place does not have is left out, never rendered dead.
 */
export interface CallBarProps<L extends string, F> {
  copy: CopySlice<L, CallBarText<F>, F>;
  phone: string | null;
  whatsapp: string | null;
  /** Where the form is: `view.href("#quote")`. */
  quoteHref: string;
  /** The bar's accessible name: "Contact". */
  label: string;
  /** For a page that anchors or shoots the bar (`#callbar` in e2e). */
  id?: string;
  className?: string;
  /** The brand's CTA face (type, weight), applied to every button. */
  buttonClassName?: string;
  /** Per button, after `buttonClassName`: the geometry of each channel. */
  classNames?: PartClassNames<CallBarPart>;
  /**
   * The place's hours: the bar then orders its buttons with `LeadCapture`'s
   * resolver — open, the call first; closed, the callback and WhatsApp, the
   * call last. Absent: the fixed order it always had.
   */
  hours?: readonly OpeningHours[] | null;
  /** "Now" for the hours — the page's render stamp; a cached page is that old. */
  now?: number;
  timeZone?: string;
  /** "Call me back", linked to `LeadCapture`'s callback (`view.href("#quote-callback")`). */
  callback?: { href: string; label: string };
}

const LEGACY: readonly CaptureChannel[] = ["phone", "whatsapp", "form"];

export function CallBar<L extends string, F>(props: CallBarProps<L, F>) {
  const { copy, phone, whatsapp, quoteHref, label, id, className, buttonClassName, classNames: c, hours, callback } = props;
  const { t, f } = copy;
  const resolved =
    hours === undefined
      ? null
      : resolveChannels({ phone, whatsapp, hours, sms: false, callback: callback !== undefined }, { now: new Date(props.now ?? Date.now()), timeZone: props.timeZone });
  const order = resolved?.order ?? LEGACY;
  // The filled button is the one to press: the form, or the callback while closed.
  const filled: CaptureChannel = resolved?.open === false && callback ? "callback" : "form";
  const button = (channel: CaptureChannel) => {
    switch (channel) {
      case "phone":
        return phone ? (
          <Button key={channel} href={telHref(phone)} size="xl" variant="outline" aria-label={t.callLabel(f)} className={cn("shrink-0 px-4", buttonClassName, c?.call)}>
            {/* The kit has no phone glyph; the button's name is its label. */}
            <span aria-hidden="true">☎</span>
          </Button>
        ) : null;
      case "whatsapp":
        return whatsapp ? (
          <Button key={channel} href={whatsappHref(whatsapp, t.whatsappMessage(f))} size="xl" variant="outline" className={cn("flex-1 px-3", buttonClassName, c?.whatsapp)}>
            {t.whatsappShort}
          </Button>
        ) : null;
      case "callback":
        return callback ? (
          <Button key={channel} href={callback.href} size="xl" variant={filled === "callback" ? "primary" : "outline"} data-intent="callback" className={cn("flex-1 px-3", buttonClassName, c?.callback)}>
            {callback.label}
          </Button>
        ) : null;
      case "form":
        return (
          <Button key={channel} href={quoteHref} size="xl" variant={filled === "form" ? "primary" : "outline"} data-intent="form_open" className={cn("flex-1 px-3", buttonClassName, c?.quote)}>
            {t.ctaShort}
          </Button>
        );
      case "sms":
        return null;
    }
  };
  return (
    <nav
      id={id}
      aria-label={label}
      className={cn("sticky bottom-0 z-30 flex gap-2 border-t border-border bg-background px-3 py-2.5 shadow-overlay md:hidden", className)}
    >
      {order.map(button)}
    </nav>
  );
}
