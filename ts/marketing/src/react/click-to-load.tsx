import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ClickToLoadProps {
  /**
   * What stands in until activation — a poster, a static map image — and the
   * control that activates it. Gets `load`; wire it to a real `<button>`.
   */
  placeholder: (load: () => void) => ReactNode;
  /**
   * The third-party widget (an `<iframe>`, a script-backed component). Only
   * mounted after `load()` — creating the element here does not mount it.
   */
  children: ReactNode;
  /** Fires once, on activation — the "opened the map" / "played" signal. */
  onLoad?: () => void;
  className?: string;
}

const FOCUSABLE =
  'iframe, button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Click-to-load facade: until the reader asks for it, the DOM holds the
 * placeholder and nothing else — no vendor script, no iframe, no request to
 * the vendor, no cookie. That keeps a cookieless page cookieless, and keeps a
 * ~1 MB embed off the critical path of a page that mostly never plays it.
 *
 * Suits anything that is an embed: a video player, a map, a booking widget.
 * {@link YouTubeFacade} is the video-shaped wrapper around it.
 */
export function ClickToLoad({
  placeholder,
  children,
  onLoad,
  className,
}: ClickToLoadProps) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // The activating control unmounts when pressed, so without this a keyboard
  // user is dropped onto <body> and has to tab from the top of the page to
  // reach the widget they just started.
  useEffect(() => {
    if (!loaded) return;
    const host = ref.current;
    const target = host?.querySelector<HTMLElement>(FOCUSABLE) ?? host;
    target?.focus();
  }, [loaded]);

  const load = () => {
    if (loaded) return;
    setLoaded(true);
    onLoad?.();
  };

  return (
    <div
      ref={ref}
      className={className}
      data-state={loaded ? "loaded" : "idle"}
      tabIndex={loaded ? -1 : undefined}
    >
      {loaded ? children : placeholder(load)}
    </div>
  );
}
