"use client";

import { Button, Dialog, DialogClose, DialogContent, DialogTitle } from "@evinvest/uikit";
import { useEffect } from "react";
import { isBookingScheduled } from "../core/booking";

/**
 * The place's Calendly page in a dialog — its own chunk, loaded by the click
 * that opens it (`LeadCaptureBooking`), so no third-party frame, script or
 * cookie exists on the page before the visitor asks for it. Calendly's
 * `calendly.event_scheduled` message, from its origin only, says the slot is
 * booked.
 */
export default function BookingFrame(props: { src: string; title: string; closeLabel: string; onClose: () => void; onScheduled: () => void }) {
  const { onScheduled } = props;
  useEffect(() => {
    const listen = (event: MessageEvent) => {
      if (isBookingScheduled(event)) onScheduled();
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [onScheduled]);
  return (
    <Dialog open onOpenChange={open => !open && props.onClose()}>
      <DialogContent showCloseButton={false} className="flex h-[90dvh] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-2 p-2 sm:p-3">
        <div className="flex items-center justify-between gap-3 px-2">
          <DialogTitle className="text-base">{props.title}</DialogTitle>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="touch">
              {props.closeLabel}
            </Button>
          </DialogClose>
        </div>
        <iframe src={props.src} title={props.title} className="min-h-0 w-full flex-1 rounded-[var(--control-radius)] border-0" />
      </DialogContent>
    </Dialog>
  );
}
