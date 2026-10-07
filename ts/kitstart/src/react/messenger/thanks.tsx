"use client";

import { cn } from "@evinvest/uikit";
import { hrefOf, InappHint, MessengerCta, QrPanel, useDesktop, useMessage, useMessengerAction, wordsOf } from "./action";
import type { MessengerKit } from "./types";

/**
 * AQ-3: the form is the control's; its success adds the faster way — a photo
 * on WhatsApp, the message carrying the lead's own reference — and the bot.
 * On a computer, WhatsApp is a QR code to scan with the phone that takes the
 * photo. The lead is sent already: a tap here posts nothing.
 */
export default function Thanks({ kit }: { kit: MessengerKit }) {
  const words = wordsOf(kit);
  const message = useMessage(kit);
  const action = useMessengerAction(kit, message, () => undefined, { followUp: true });
  const desktop = useDesktop();
  const whatsapp = hrefOf(kit, "whatsapp", message.message);
  return (
    <div className={cn("flex flex-col gap-3 border-t border-border pt-4", kit.classNames?.messenger)}>
      {whatsapp && !desktop && <p className="font-medium text-ink">{words.messengerThanksTitle}</p>}
      {whatsapp && (desktop ? <QrPanel href={whatsapp} words={words} onCallback={null} kit={kit} /> : <MessengerCta kit={kit} action={action} channel="whatsapp" label={words.messengerThanksCta} />)}
      {whatsapp && !desktop && <InappHint kit={kit} message={message.message} />}
      {kit.facts.telegram && <MessengerCta kit={kit} action={action} channel="telegram" label={desktop ? words.messengerTelegramCta : words.messengerOptionTelegram} variant="outline" />}
    </div>
  );
}
