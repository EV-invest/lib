"use client";

import { cn } from "@evinvest/uikit";
import { InappHint, MessengerCta, Preview, Slot, SquareButton, toCall, useMessage, useMessengerAction, wordsOf } from "./action";
import type { MessengerKit } from "./types";

/**
 * VF-6: the slot — the message, or the phone — over one row: «Devis sur
 * WhatsApp» with the bot and a call as squares beside it; the call's square
 * turns the row into «Être rappelé» with WhatsApp and the bot as squares.
 */
export default function Split({ kit }: { kit: MessengerKit }) {
  const words = wordsOf(kit);
  const message = useMessage(kit);
  const action = useMessengerAction(kit, message, () => toCall(kit));
  const call = kit.mode === "call";
  const telegram = kit.facts.telegram && <MessengerCta kit={kit} action={action} channel="telegram" label={words.messengerOptionTelegram} variant="outline" square />;
  return (
    <div className={cn("flex flex-col gap-3", kit.classNames?.messenger)}>
      <Slot kit={kit}>{call ? kit.phone() : (action.panel ?? <Preview kit={kit} preview={message.preview} />)}</Slot>
      <div className="flex gap-2">
        {call ? (
          <>
            <div className="min-w-0 flex-1">{kit.submit(words.messengerCallback)}</div>
            <SquareButton kit={kit} channel="whatsapp" label={words.messengerBackToWhatsapp} onClick={() => kit.setMode("whatsapp")} />
            {telegram}
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <MessengerCta kit={kit} action={action} channel="whatsapp" label={words.messengerSplitCta} />
            </div>
            {telegram}
            <SquareButton kit={kit} channel="call" label={words.messengerCallback} onClick={() => toCall(kit)} />
          </>
        )}
      </div>
      {!call && <InappHint kit={kit} message={message.message} />}
      {action.overlay}
    </div>
  );
}
