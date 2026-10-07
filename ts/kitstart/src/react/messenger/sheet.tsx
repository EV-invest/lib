"use client";

import { Button, cn, Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@evinvest/uikit";
import { useState, type MouseEvent } from "react";
import { InappHint, modesOf, OptionCard, useMessage, useMessengerAction, wordsOf, type MessengerAction } from "./action";
import type { MessengerKit } from "./types";

/**
 * VF-4: the card is the estimate, the postcode and one button; the button
 * opens the kit's drawer — «Où recevoir votre devis ?»: WhatsApp
 * (recommended), the bot, a call — and a call asks the phone in the drawer,
 * a field of the card's form wherever the drawer is drawn (`form`).
 */
export default function Sheet({ kit }: { kit: MessengerKit }) {
  const words = wordsOf(kit);
  const message = useMessage(kit);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"pick" | "call">("pick");
  const action = useMessengerAction(kit, message, () => {
    setStep("call");
    setOpen(true);
  });
  const formId = `${kit.id}-form`;
  // The app takes over: the drawer goes with it — unless the tap drew the QR code in it.
  const closing = (link: ReturnType<MessengerAction["link"]>): ReturnType<MessengerAction["link"]> =>
    link && {
      ...link,
      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        link.onClick(event);
        if (!event.defaultPrevented) setOpen(false);
      },
    };
  return (
    <div className={cn("flex flex-col gap-3", kit.classNames?.messenger)}>
      <Drawer
        open={open}
        onOpenChange={next => {
          setOpen(next);
          if (!next) setStep("pick");
        }}
      >
        <DrawerTrigger asChild>
          <Button type="button" size="touch" className="w-full">
            {words.messengerSheetCta}
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <div className={cn("flex flex-col gap-4 p-4", kit.classNames?.messengerPicker)}>
            {step === "pick" ? (
              <>
                <DrawerTitle className="font-display text-xl font-bold text-ink">{words.messengerSheetTitle}</DrawerTitle>
                {action.panel}
                {modesOf(kit, ["whatsapp", "telegram", "call"]).map(mode =>
                  mode === "call" ? (
                    <OptionCard key={mode} kit={kit} mode={mode} onPick={() => setStep("call")} />
                  ) : (
                    <OptionCard key={mode} kit={kit} mode={mode} link={closing(action.link(mode))} recommended={mode === "whatsapp"} />
                  ),
                )}
                <InappHint kit={kit} message={message.message} />
              </>
            ) : (
              <>
                <Button type="button" variant="link" size="sm" className="self-start px-0" onClick={() => setStep("pick")}>
                  ‹ {words.messengerChange}
                </Button>
                <DrawerTitle className="font-display text-xl font-bold text-ink">{words.messengerCallTitle}</DrawerTitle>
                {kit.phone({ form: formId })}
                {kit.submit(words.messengerCallback, { form: formId })}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      {action.overlay}
    </div>
  );
}
