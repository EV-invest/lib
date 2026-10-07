"use client";

import { cn, ToggleGroup, ToggleGroupItem } from "@evinvest/uikit";
import { Glyph, labelOf, ModeBody, TelegramLink, toCall, useMessage, useMessengerAction, wordsOf } from "./action";
import type { MessengerKit } from "./types";

/**
 * AQ-2: «WhatsApp | Appel» over a slot of one height — the message ready to
 * send, or the phone — and the bot as a link under the button.
 */
export default function Segment({ kit }: { kit: MessengerKit }) {
  const words = wordsOf(kit);
  const message = useMessage(kit);
  const action = useMessengerAction(kit, message, () => toCall(kit));
  const mode = kit.mode === "call" ? "call" : "whatsapp";
  return (
    <div className={cn("flex flex-col gap-3", kit.classNames?.messenger)}>
      <ToggleGroup
        role="group"
        type="single"
        value={mode}
        onValueChange={v => (v === "call" || v === "whatsapp" ? kit.setMode(v) : undefined)}
        aria-label={words.messengerChannelLabel}
        className={cn("w-full gap-1 rounded-[var(--control-radius)] bg-muted p-1", kit.classNames?.messengerPicker)}
      >
        {(["whatsapp", "call"] as const).map(m => (
          <ToggleGroupItem key={m} value={m} className={cn("h-10 flex-1 gap-2 rounded-[var(--control-radius)] data-[state=on]:bg-card data-[state=on]:text-ink", kit.classNames?.messengerSegment)}>
            <Glyph kit={kit} channel={m} />
            {labelOf(words, m)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ModeBody kit={{ ...kit, mode }} message={message} action={action} />
      <TelegramLink kit={kit} action={action} />
      {action.overlay}
    </div>
  );
}
