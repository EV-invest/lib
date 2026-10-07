"use client";

import { Button, cn } from "@evinvest/uikit";
import { Glyph, InappHint, MessengerCta, Slot, SquareButton, toCall, useMessage, useMessengerAction, wordsOf } from "./action";
import type { MessengerKit } from "./types";

/**
 * AQ-4 / VF-3: no phone until it is asked for. Slot A is the WhatsApp button,
 * row B the bot and «Être rappelé»; «Être rappelé» swaps them — A becomes the
 * phone, B a square back to WhatsApp beside the call's submit — so the card
 * keeps its height. On a computer, the QR code takes slot A.
 */
export default function Swap({ kit }: { kit: MessengerKit }) {
  const words = wordsOf(kit);
  const message = useMessage(kit);
  const action = useMessengerAction(kit, message, () => toCall(kit));
  const call = kit.mode === "call";
  return (
    <div className={cn("flex flex-col gap-3", kit.classNames?.messenger)}>
      <Slot kit={kit}>
        {call ? kit.phone({ after: null }) : (action.panel ?? <MessengerCta kit={kit} action={action} channel="whatsapp" label={words.messengerWhatsappCta} />)}
      </Slot>
      <div className="flex gap-3">
        {call ? (
          <>
            <SquareButton kit={kit} channel="whatsapp" label={words.messengerBackToWhatsapp} onClick={() => kit.setMode("whatsapp")} />
            <div className="min-w-0 flex-1">{kit.submit()}</div>
          </>
        ) : (
          <>
            {kit.facts.telegram && (
              <div className="min-w-0 flex-1">
                <MessengerCta kit={kit} action={action} channel="telegram" label={words.messengerOptionTelegram} variant="outline" />
              </div>
            )}
            <Button type="button" variant="outline" size="touch" className={cn("min-w-0 flex-1", kit.classNames?.messengerSecondary)} onClick={() => toCall(kit)}>
              <Glyph kit={kit} channel="call" />
              {words.messengerCallback}
            </Button>
          </>
        )}
      </div>
      {!call && <InappHint kit={kit} message={message.message} />}
      {action.overlay}
    </div>
  );
}
