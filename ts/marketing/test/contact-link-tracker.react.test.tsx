import { render, screen } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContactLinkTracker, type ContactClick } from "../src/react/index";

// Records whether anything before it cancelled the click, then cancels it
// itself so jsdom does not attempt the navigation. Registered on `window` in
// the bubble phase: it runs after every listener under test.
let reachedDefault: boolean[] = [];
const onWindowClick = (e: Event) => {
  reachedDefault.push(!e.defaultPrevented);
  e.preventDefault();
};

beforeEach(() => {
  reachedDefault = [];
  window.addEventListener("click", onWindowClick);
});
afterEach(() => window.removeEventListener("click", onWindowClick));

/** A widget that swallows its own clicks the way third-party markup does. */
function Swallowing() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = ref.current;
    const stop = (e: Event) => {
      e.stopImmediatePropagation();
      e.preventDefault(); // also keeps jsdom from attempting the navigation
    };
    el?.addEventListener("click", stop);
    return () => el?.removeEventListener("click", stop);
  }, []);
  return (
    <a ref={ref} href="https://wa.me/33612345678" data-location="widget">
      widget chat
    </a>
  );
}

function Page({ onContact }: { onContact: (c: ContactClick) => void }) {
  return (
    <ContactLinkTracker onContact={onContact}>
      <a href="tel:+33123456789" data-location="hero" data-variant="b">
        call
      </a>
      <a href="https://wa.me/33612345678?text=hi">
        <span>whatsapp</span>
      </a>
      <a href="https://api.whatsapp.com/send?phone=33612345678">api chat</a>
      <a href="mailto:hello@example.com">mail</a>
      <a href="https://example.com/about">about</a>
      <a href="/contact">contact page</a>
      <span
        onClick={e => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <a href="tel:+331">inner call</a>
      </span>
      <Swallowing />
    </ContactLinkTracker>
  );
}

describe("ContactLinkTracker", () => {
  it("reports each contact channel with its href and data attributes", () => {
    const onContact = vi.fn();
    render(<Page onContact={onContact} />);

    screen.getByText("call").click();
    screen.getByText("whatsapp").click(); // a child of the link, not the link
    screen.getByText("api chat").click();
    screen.getByText("mail").click();

    expect(onContact.mock.calls.map(([c]) => c)).toEqual([
      {
        channel: "phone",
        href: "tel:+33123456789",
        data: { location: "hero", variant: "b" },
      },
      { channel: "whatsapp", href: "https://wa.me/33612345678?text=hi", data: {} },
      {
        channel: "whatsapp",
        href: "https://api.whatsapp.com/send?phone=33612345678",
        data: {},
      },
      { channel: "email", href: "mailto:hello@example.com", data: {} },
    ]);
  });

  it("ignores links that are not contact links", () => {
    const onContact = vi.fn();
    render(<Page onContact={onContact} />);
    screen.getByText("about").click();
    screen.getByText("contact page").click();
    expect(onContact).not.toHaveBeenCalled();
  });

  it("still sees clicks a descendant stops — it listens in the capture phase", () => {
    const onContact = vi.fn();
    render(<Page onContact={onContact} />);
    screen.getByText("inner call").click();
    screen.getByText("widget chat").click();
    expect(onContact.mock.calls.map(([c]) => c.channel)).toEqual(["phone", "whatsapp"]);
  });

  it("never cancels the navigation it observes", () => {
    render(<Page onContact={() => {}} />);
    screen.getByText("call").click();
    screen.getByText("mail").click();
    expect(reachedDefault).toEqual([true, true]);
  });

  it("filters by channel when asked", () => {
    const onContact = vi.fn();
    render(
      <ContactLinkTracker onContact={onContact} channels={["whatsapp"]}>
        <a href="tel:+331">call</a>
        <a href="https://wa.me/331">chat</a>
      </ContactLinkTracker>,
    );
    screen.getByText("call").click();
    screen.getByText("chat").click();
    expect(onContact.mock.calls.map(([c]) => c.channel)).toEqual(["whatsapp"]);
  });
});
