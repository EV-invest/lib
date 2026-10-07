import { cn } from "@evinvest/uikit";
import type { MessengerMode } from "../../core/messenger";
import type { LeadCaptureMessengerText } from "../../core/messenger-text";
import { ChannelPicker, Glyph, ModeBody, toCall, useMessage, useMessengerAction, wordsOf } from "./action";
import type { MessengerKit } from "./types";

const chipOf = (words: LeadCaptureMessengerText, mode: MessengerMode): string =>
  mode === "whatsapp" ? words.messengerChipWhatsapp : mode === "telegram" ? words.messengerChipTelegram : words.messengerChipCall;

/**
 * VF-5: the lede becomes a chip naming where the answer comes — its menu an
 * overlay over the form — and the slot follows it: the message, the bot, or the phone.
 */
export default function Chip({ kit }: { kit: MessengerKit }) {
  return kit.at === "afterHead" ? <ChipMenu kit={kit} /> : <ChipBody kit={kit} />;
}

function ChipMenu({ kit }: { kit: MessengerKit }) {
  const mode = kit.mode ?? "whatsapp";
  return (
    <ChannelPicker
      kit={kit}
      triggerClassName="h-8 w-fit rounded-full bg-muted px-3 text-sm font-medium text-ink"
      trigger={
        <span className="flex items-center gap-2">
          <Glyph kit={kit} channel={mode} />
          {chipOf(wordsOf(kit), mode)}
        </span>
      }
    />
  );
}

function ChipBody({ kit }: { kit: MessengerKit }) {
  const message = useMessage(kit);
  const action = useMessengerAction(kit, message, () => toCall(kit));
  return (
    <div className={cn("flex flex-col gap-3", kit.classNames?.messenger)}>
      <ModeBody kit={kit} message={message} action={action} />
      {action.overlay}
    </div>
  );
}
