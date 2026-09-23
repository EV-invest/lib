import { telHref, whatsappHref } from "@evinvest/marketing";
import { Button } from "@evinvest/uikit";
import { cx } from "./cx";
import type { CallBarText, CopySlice } from "../core/content";

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
  className?: string;
  /** The brand's CTA face (type, weight), applied to every button. */
  buttonClassName?: string;
}

export function CallBar<L extends string, F>({ copy, phone, whatsapp, quoteHref, className, buttonClassName }: CallBarProps<L, F>) {
  const { t, f } = copy;
  return (
    <div id="callbar" className={cx("sticky bottom-0 z-30 flex gap-2 border-t border-border bg-background px-3 py-2.5 shadow-overlay md:hidden", className)}>
      {phone && (
        <Button href={telHref(phone)} size="xl" variant="outline" aria-label={t.callLabel(f)} className={cx("shrink-0 px-4", buttonClassName)}>
          ☎
        </Button>
      )}
      {whatsapp && (
        <Button href={whatsappHref(whatsapp, t.whatsappMessage(f))} size="xl" variant="outline" className={cx("flex-1 px-3", buttonClassName)}>
          {t.whatsappShort}
        </Button>
      )}
      <Button href={quoteHref} size="xl" data-intent="form_open" className={cx("flex-1 px-3", buttonClassName)}>
        {t.ctaShort}
      </Button>
    </div>
  );
}
