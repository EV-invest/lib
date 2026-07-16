import * as React from "react";

export interface HoverIntentHandlers {
  onPointerEnter: (event: React.PointerEvent) => void;
  onPointerLeave: (event: React.PointerEvent) => void;
}

/**
 * Mouse-only hover-with-intent for the {@link InfoTip} toggletip: opens after the
 * cursor dwells `openDelay`ms over the trigger, closes after `closeDelay`ms once
 * it leaves. Touch and pen pointers are ignored — they have no hover, so a
 * coarse-pointer device never fires this and the toggletip's click/tap path takes
 * over. This timer is the one piece of behaviour with no Rust counterpart: the
 * Dioxus kit has no host timers (the same reason it has no Portal or floating
 * engine — see the README "Limitations"), so its trigger opens on hover instantly.
 */
export function useHoverIntent(opts: {
  onOpen: () => void;
  onClose: () => void;
  openDelay?: number;
  closeDelay?: number;
}): HoverIntentHandlers {
  const { onOpen, onClose, openDelay = 500, closeDelay = 0 } = opts;

  const openRef = React.useRef(onOpen);
  const closeRef = React.useRef(onClose);
  React.useEffect(() => {
    openRef.current = onOpen;
    closeRef.current = onClose;
  });

  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = React.useCallback(() => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  React.useEffect(() => clear, [clear]);

  const onPointerEnter = React.useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      clear();
      timer.current = setTimeout(() => {
        timer.current = null;
        openRef.current();
      }, openDelay);
    },
    [clear, openDelay],
  );

  const onPointerLeave = React.useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      clear();
      if (closeDelay > 0) {
        timer.current = setTimeout(() => {
          timer.current = null;
          closeRef.current();
        }, closeDelay);
      } else {
        closeRef.current();
      }
    },
    [clear, closeDelay],
  );

  return { onPointerEnter, onPointerLeave };
}
