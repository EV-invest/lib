import type { CSSProperties, MouseEvent, ReactNode } from "react";

import { contactChannel, type ContactChannel } from "../core/contact";

/** What the tracker reports for one contact-link click. */
export interface ContactClick {
  channel: ContactChannel;
  /** The link's `href` attribute as authored. */
  href: string;
  /**
   * The link's `data-*` attributes (camelCased, as `dataset` names them), so a
   * call site can tag a link — `data-location="hero"` — without the tracker
   * knowing the vocabulary.
   */
  data: Readonly<Record<string, string>>;
}

export interface ContactLinkTrackerProps {
  /**
   * The injected sink. Wire your analytics `capture` here; this package never
   * imports an analytics SDK.
   */
  onContact: (click: ContactClick) => void;
  /** Report only these channels. Default: all. */
  channels?: readonly ContactChannel[];
  children: ReactNode;
}

// `display: contents` so the wrapper adds a node for the listener without
// adding a box to the layout. Inline, so it holds without Tailwind scanning.
const CONTENTS: CSSProperties = { display: "contents" };

/**
 * Reports clicks on outbound contact links (`tel:`, `mailto:`, WhatsApp)
 * anywhere in its subtree, through one delegated listener rather than a
 * handler per link — so links rendered by the CMS copy, a footer the app does
 * not own, or a third-party widget are counted too.
 *
 * Capture phase, deliberately: it runs before any descendant's own listeners,
 * so a `stopPropagation()` inside a widget cannot swallow the event, and before
 * the browser hands `tel:` / `wa.me` to another app — the page may be
 * backgrounded right after. It never calls `preventDefault`: the tracker
 * observes the navigation, it does not own it. Delivery across a page hide is
 * the sink's job (a beacon transport), not this component's.
 */
export function ContactLinkTracker({
  onContact,
  channels,
  children,
}: ContactLinkTrackerProps) {
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target instanceof Element ? e.target : null;
    const link = target?.closest<HTMLAnchorElement | SVGAElement>("a[href]");
    const href = link?.getAttribute("href");
    if (!link || !href) return;
    const channel = contactChannel(href);
    if (!channel || (channels && !channels.includes(channel))) return;
    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(link.dataset)) {
      if (value !== undefined) data[key] = value;
    }
    onContact({ channel, href, data });
  };

  return (
    <div style={CONTENTS} onClickCapture={onClickCapture}>
      {children}
    </div>
  );
}
