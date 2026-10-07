"use client";

import { cn, ToggleGroup, ToggleGroupItem } from "@evinvest/uikit";
import type { MessengerMode } from "../../core/messenger";
import { Glyph, labelOf, ModeBody, modesOf, toCall, useMessage, useMessengerAction, wordsOf } from "./action";
import type { MessengerKit } from "./types";

/**
 * VF-2: «Recevoir mon devis par» and a tile per channel — WhatsApp, Telegram,
 * Appel — over a slot of one height: the message, what the bot does, or the phone.
 */
export default function Tiles({ kit }: { kit: MessengerKit }) {
  const words = wordsOf(kit);
  const message = useMessage(kit);
  const action = useMessengerAction(kit, message, () => toCall(kit));
  const modes = modesOf(kit, ["whatsapp", "telegram", "call"]);
  const mode = kit.mode ?? "whatsapp";
  return (
    <div className={cn("flex flex-col gap-3", kit.classNames?.messenger)}>
      <p className="text-sm font-medium text-ink">{words.messengerTilesLabel}</p>
      <ToggleGroup
        role="group"
        type="single"
        value={mode}
        onValueChange={v => {
          const picked = modes.find((m): m is MessengerMode => m === v);
          if (picked) kit.setMode(picked);
        }}
        aria-label={words.messengerTilesLabel}
        className={cn("grid w-full gap-2", modes.length === 3 ? "grid-cols-3" : "grid-cols-2", kit.classNames?.messengerPicker)}
      >
        {modes.map(m => (
          <ToggleGroupItem
            key={m}
            value={m}
            className={cn(
              "h-11 gap-2 rounded-[var(--control-radius)] border border-border first:rounded-[var(--control-radius)] last:rounded-[var(--control-radius)] data-[state=on]:border-primary data-[state=on]:text-ink",
              kit.classNames?.messengerTile,
            )}
          >
            <Glyph kit={kit} channel={m} />
            {labelOf(words, m)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ModeBody kit={kit} message={message} action={action} />
      {action.overlay}
    </div>
  );
}
