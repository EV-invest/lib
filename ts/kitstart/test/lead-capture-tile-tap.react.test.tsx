import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEAD_CAPTURE_TEXT, type OpeningHours, type Place } from "../src/index";
import { LeadCapture, type LeadCaptureProps } from "../src/react/index";
import { serviceAreaPlace } from "../src/testing/index";

// A tap on an answer tile as Safari (WebKit, iOS and macOS) delivers it.
//
// The tile's radio is `absolute inset-0` with no width or height: Chromium
// stretches it over the tile, WebKit keeps a radio's own 12x12 box in the
// corner. So in WebKit a finger on the tile's words lands on the tile's
// <span>, not the radio: `pointerdown` and the first `click` (detail 1) go to
// the span, and the <label> then forwards its own click to the radio with
// `detail` 0 — the same `detail` an arrow key's click has. Seen in Playwright
// WebKit on desgenettes.aquafix.top (lead_form=c), iPhone 14 profile:
//   pointerdown target=SPAN · click target=SPAN detail=1 · click target=INPUT detail=0 · change
// and the screen stays on the intro with the tile checked.

const WEEKDAYS: readonly OpeningHours[] = [{ days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "19:00" }];
const MONDAY_10H = new Date("2026-10-05T08:00:00Z").getTime();
const MOBILE = "+33 6 12 34 56 78";
const place: Place<"fr" | "en"> = serviceAreaPlace(["fr", "en"], { hours: WEEKDAYS });
const INTRO = {
  label: "When do you need us?",
  field: "urgency",
  options: [
    { value: "today", label: "Urgent — today", channel: "callback" as const },
    { value: "week", label: "This week" },
    { value: "compare", label: "Comparing prices" },
  ],
};
const NEEDS = [
  { value: "blocked_drain", label: "Blocked drain" },
  { value: "leak", label: "Leak" },
];

function capture(over: Partial<LeadCaptureProps> = {}): ReactElement {
  return (
    <LeadCapture
      place={place}
      contact={{ phone: MOBILE, whatsapp: MOBILE }}
      locale="en"
      renderedAt={MONDAY_10H}
      wire={{ subject: "job", locality: "zip", mobile: "mobile" }}
      needs={NEEDS}
      flows={{ blocked_drain: "quote", leak: "quote" }}
      text={LEAD_CAPTURE_TEXT.en}
      layout="steps"
      needDisplay="cards"
      intro={INTRO}
      {...over}
    />
  );
}

const form = () => {
  const el = document.getElementById("quote-form");
  if (!(el instanceof HTMLFormElement)) throw new Error("no form");
  return el;
};
/** The screen on: the one step not hidden. */
const shown = () => [...form().querySelectorAll<HTMLElement>("[data-lead-step]")].filter(s => !s.hasAttribute("data-lead-off") && s.style.display !== "none").map(s => s.dataset["leadStep"]);

/** The tile's visible face — what a finger on its words touches when the radio does not cover it. */
const face = (name: string) => {
  const radio = screen.getByRole("radio", { name });
  const span = radio.nextElementSibling;
  if (!(span instanceof HTMLElement)) throw new Error(`no tile face for ${name}`);
  return span;
};

/**
 * WebKit's tap on a tile's words, as the tile's radio receives it: the pointer
 * lands on the face, and the radio gets only the click the <label> forwards,
 * `detail` 0. Fired on the radio directly: jsdom's own label forwarding keeps
 * the user's `detail`, which WebKit's does not.
 */
const safariTap = (name: string) => {
  const radio = screen.getByRole("radio", { name });
  fireEvent.pointerDown(face(name));
  fireEvent.pointerUp(face(name));
  fireEvent.click(radio, { detail: 0 });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MONDAY_10H);
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("LeadCapture's answer tiles, tapped in Safari", () => {
  it("should move on from the intro when the tap lands on the tile's words, not on the radio", () => {
    render(capture());
    expect(shown()).toEqual(["intro"]);

    safariTap("Comparing prices");

    expect(shown(), "a tap on the tile is an answer: the need's screen comes next").toEqual(["need"]);
  });

  it("should move on when the tile tapped is the one already chosen", () => {
    render(capture());
    fireEvent.pointerDown(screen.getByRole("radio", { name: "Comparing prices" }));
    fireEvent.click(screen.getByRole("radio", { name: "Comparing prices" }), { detail: 1 });
    expect(shown()).toEqual(["need"]);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(shown()).toEqual(["intro"]);

    safariTap("Comparing prices");

    expect(shown(), "the chosen tile, tapped again, answers again").toEqual(["need"]);
  });

  it("should move on from the need's cards when the tap lands on the card's words", () => {
    render(capture({ intro: undefined }));
    expect(shown()).toEqual(["need"]);

    safariTap("Leak");

    expect(shown(), "a tap on a need's card is an answer: the postcode's screen comes next").toEqual(["locality"]);
  });
});
