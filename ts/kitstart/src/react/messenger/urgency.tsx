"use client";

import { cn, ToggleGroup, ToggleGroupItem } from "@evinvest/uikit";
import { fillText } from "../../core/lead-capture-format";
import { MessengerCta, InappHint, Preview, Slot, TelegramLink, toCall, useMessage, useMessengerAction, wordsOf } from "./action";
import type { MessengerKit } from "./types";

/** What the answer is posted as, in the brand's extra: a slug, never the label. */
const ANSWER = { call: "today", whatsapp: "later" } as const;

/**
 * AQ-6: «C’est urgent ?» picks the channel — today is a call, «je compare»
 * the message ready in the slot — and the answer is the lead's, posted as
 * the brand's extra (`field`, which `site.lead.extras` must list). Without
 * WhatsApp the question stays, and both answers ask the phone.
 */
export default function Urgency({ kit }: { kit: MessengerKit }) {
  return kit.at === "beforeNeed" ? <Question kit={kit} /> : <UrgencyContact kit={kit} />;
}

function Question({ kit }: { kit: MessengerKit }) {
  const words = wordsOf(kit);
  const field = kit.variant.kind === "urgency" ? kit.variant.field : "urgency";
  const answer = kit.mode === "call" || kit.mode === "whatsapp" ? kit.mode : null;
  return (
    <div className={cn("flex flex-col gap-2", kit.classNames?.messenger)}>
      <p className="text-sm font-medium text-ink">{words.messengerUrgencyLabel}</p>
      <ToggleGroup
        role="group"
        type="single"
        value={answer ?? ""}
        onValueChange={v => (v === "call" || v === "whatsapp" ? kit.setMode(v) : undefined)}
        aria-label={words.messengerUrgencyLabel}
        className={cn("grid w-full grid-cols-2 gap-2", kit.classNames?.messengerPicker)}
      >
        {(["call", "whatsapp"] as const).map(m => (
          <ToggleGroupItem
            key={m}
            value={m}
            className={cn(
              "h-11 rounded-[var(--control-radius)] border border-border first:rounded-[var(--control-radius)] last:rounded-[var(--control-radius)] data-[state=on]:border-primary data-[state=on]:text-ink",
              kit.classNames?.messengerTile,
            )}
          >
            {m === "call" ? words.messengerUrgencyYes : words.messengerUrgencyNo}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {answer && <input type="hidden" name={field} value={ANSWER[answer]} />}
    </div>
  );
}

function UrgencyContact({ kit }: { kit: MessengerKit }) {
  const words = wordsOf(kit);
  const message = useMessage(kit, kit.mode === "call" ? words.messengerUrgencyToday : kit.mode === "whatsapp" ? words.messengerUrgencyLater : null);
  const action = useMessengerAction(kit, message, () => toCall(kit));
  const chat = kit.mode === "whatsapp" && kit.facts.whatsapp !== null;
  return (
    <div className={cn("flex flex-col gap-3", kit.classNames?.messenger)}>
      <Slot kit={kit}>
        {chat ? (action.panel ?? <Preview kit={kit} preview={message.preview} title={words.messengerNotUrgentTitle} lede={fillText(words.messengerNotUrgentLede, { ref: kit.messageRef ?? "" })} />) : kit.phone()}
      </Slot>
      {chat ? <MessengerCta kit={kit} action={action} channel="whatsapp" label={words.messengerWhatsappCta} /> : kit.submit(kit.mode === "call" ? words.messengerUrgentSubmit : undefined)}
      {chat && <InappHint kit={kit} message={message.message} />}
      <TelegramLink kit={kit} action={action} />
      {action.overlay}
    </div>
  );
}
