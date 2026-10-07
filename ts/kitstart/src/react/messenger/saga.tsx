"use client";

import { Button, cn } from "@evinvest/uikit";
import type { MessengerMode } from "../../core/messenger";
import type { LeadCaptureMessengerText } from "../../core/messenger-text";
import { ModeBody, modesOf, OptionCard, toCall, useMessage, useMessengerAction, wordsOf } from "./action";
import type { MessengerKit } from "./types";

const headOf = (words: LeadCaptureMessengerText, mode: MessengerMode): [string, string] =>
  mode === "whatsapp" ? [words.messengerWhatsappTitle, words.messengerWhatsappLede] : mode === "telegram" ? [words.messengerTelegramTitle, words.messengerTelegramLede] : [words.messengerCallTitle, words.messengerCallLede];

/**
 * AQ-5: the channel first, on a screen of its own — WhatsApp (recommended),
 * a call, the bot — then the job and the channel's slot, «Changer de canal»
 * in the same place on every screen. The card's height is the brand's
 * (`root`): the screens change what is in it, the button stays at the bottom.
 */
export default function Saga({ kit }: { kit: MessengerKit }) {
  if (kit.at === "head") return <SagaHead kit={kit} />;
  if (kit.at === "body") return <SagaPick kit={kit} />;
  return <SagaContact kit={kit} />;
}

function SagaHead({ kit }: { kit: MessengerKit }) {
  const words = wordsOf(kit);
  const [title, lede] = kit.mode === null ? [words.messengerSagaTitle, words.messengerSagaLede] : headOf(words, kit.mode);
  return (
    <div className="flex flex-col gap-1">
      {kit.mode !== null && (
        <Button type="button" variant="link" size="sm" className="self-start px-0" onClick={() => kit.setMode(null)}>
          ‹ {words.messengerChange}
        </Button>
      )}
      <p className="font-display text-2xl font-bold text-ink">{title}</p>
      <p className="text-ink-soft">{lede}</p>
    </div>
  );
}

function SagaPick({ kit }: { kit: MessengerKit }) {
  const words = wordsOf(kit);
  return (
    <div className={cn("flex flex-1 flex-col gap-3", kit.classNames?.messenger)}>
      {modesOf(kit).map(mode => (
        <OptionCard key={mode} kit={kit} mode={mode} recommended={mode === "whatsapp"} onPick={() => (mode === "call" ? toCall(kit) : kit.setMode(mode))} />
      ))}
      <p className="mt-auto text-center text-sm text-ink-soft">{words.messengerSagaFoot}</p>
    </div>
  );
}

function SagaContact({ kit }: { kit: MessengerKit }) {
  const words = wordsOf(kit);
  const message = useMessage(kit);
  const action = useMessengerAction(kit, message, () => toCall(kit));
  return (
    <div className={cn("flex flex-1 flex-col gap-3", kit.classNames?.messenger)}>
      <ModeBody kit={kit} message={message} action={action} labels={{ whatsapp: words.messengerOpenWhatsapp }} />
      {action.overlay}
    </div>
  );
}
