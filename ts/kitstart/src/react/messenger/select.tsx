import { cn, InputGroup, InputGroupAddon } from "@evinvest/uikit";
import type { ReactNode } from "react";
import { ChannelPicker, Glyph, InappHint, labelOf, MessengerCta, toCall, useMessage, useMessengerAction, wordsOf } from "./action";
import type { MessengerKit } from "./types";

/**
 * AQ-1 / VF-1: the channel picked in the phone field itself — before the
 * number (`prefix`) or after it (`suffix`). WhatsApp: the number optional,
 * the button opens the chat. Appel: the number required, the control's
 * submit. Telegram: no number, the button opens the bot.
 */
export default function SelectVariant({ kit }: { kit: MessengerKit }) {
  const words = wordsOf(kit);
  const message = useMessage(kit);
  const action = useMessengerAction(kit, message, () => toCall(kit));
  const mode = kit.mode ?? "whatsapp";
  const side = kit.variant.kind === "select" && kit.variant.side === "suffix" ? "end" : "start";
  const picker = (
    <ChannelPicker
      kit={kit}
      triggerClassName={cn("h-full rounded-none bg-transparent px-3", side === "start" ? "border-r border-input" : "border-l border-input")}
      trigger={
        <span className="flex items-center gap-2 font-medium text-ink">
          <Glyph kit={kit} channel={mode} />
          {labelOf(words, mode)}
        </span>
      }
    />
  );
  const hint = mode === "call" ? undefined : <p className={cn("text-sm text-ink-soft", kit.classNames?.messengerHint)}>{mode === "whatsapp" ? words.messengerWhatsappHint : words.messengerTelegramHint}</p>;
  return (
    <div className={cn("flex flex-col gap-3", kit.classNames?.messenger)}>
      {kit.phone({
        optional: mode !== "call",
        disabled: mode === "telegram",
        ...(mode !== "call" ? { placeholder: words.messengerPhoneOptional } : {}),
        frame: (input: ReactNode) => (
          <InputGroup className={cn("h-12 rounded-[var(--control-radius)]", kit.classNames?.messengerPicker)}>
            {side === "start" && <InputGroupAddon align="inline-start">{picker}</InputGroupAddon>}
            {input}
            {side === "end" && <InputGroupAddon align="inline-end">{picker}</InputGroupAddon>}
          </InputGroup>
        ),
        ...(hint ? { after: hint } : {}),
      })}
      {action.panel ??
        (mode === "call" ? (
          kit.submit()
        ) : (
          <MessengerCta kit={kit} action={action} channel={mode} label={mode === "whatsapp" ? words.messengerWhatsappCta : words.messengerTelegramCta} />
        ))}
      {mode === "whatsapp" && <InappHint kit={kit} message={message.message} />}
      {action.overlay}
    </div>
  );
}
