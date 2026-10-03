import type { AnalyticsSink } from "@evinvest/analytics";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEAD_CAPTURE_TEXT, leadErrorOf, type OpeningHours, type Place } from "../src/index";
import { AnalyticsSinkContext } from "../src/react/analytics-context";
import { LeadCapture, type LeadCaptureProps } from "../src/react/index";
import { navigation, SUBMIT_TIMEOUT_MS } from "../src/react/use-lead-submit";
import { serviceAreaPlace, storefrontPlace } from "../src/testing/index";

const WEEKDAYS: readonly OpeningHours[] = [{ days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "19:00" }];
// Paris is UTC+2 in October 2026.
const MONDAY_10H = new Date("2026-10-05T08:00:00Z").getTime();
const FRIDAY_20H = new Date("2026-10-09T18:00:00Z").getTime();

const place: Place<"fr" | "en"> = serviceAreaPlace(["fr", "en"], { hours: WEEKDAYS });
const MOBILE = "+33 6 12 34 56 78";
const NEEDS = [
  { value: "leak", label: "Fuite d’eau" },
  { value: "boiler", label: "Chaudière" },
];

function capture(over: Partial<LeadCaptureProps> = {}): ReactElement {
  return (
    <LeadCapture
      place={place}
      contact={{ phone: MOBILE, whatsapp: MOBILE }}
      locale="fr"
      renderedAt={MONDAY_10H}
      wire={{ subject: "job", locality: "zip", mobile: "mobile" }}
      needs={NEEDS}
      text={LEAD_CAPTURE_TEXT.fr}
      {...over}
    />
  );
}

/** The sink the boundary would hand down, recording what it is told. */
function recorder() {
  const events: { event: string; props: Record<string, unknown> }[] = [];
  const sink: AnalyticsSink = { capture: (event, props) => void events.push({ event, props: { ...props } }) };
  return { sink, events, wrap: (node: ReactElement) => <AnalyticsSinkContext.Provider value={sink}>{node}</AnalyticsSinkContext.Provider> };
}

const form = (id = "quote-form") => {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLFormElement)) throw new Error(`no form #${id}`);
  return el;
};
const posted = (id = "quote-form") => Object.fromEntries(new FormData(form(id)));
const input = (name: string, id = "quote-form") => {
  const el = form(id).querySelector(`input[name=${name}]`);
  if (!(el instanceof HTMLInputElement)) throw new Error(`no input ${name} in #${id}`);
  return el;
};
const radio = (value: string) => {
  const el = form().querySelector(`input[type=radio][value=${value}]`);
  if (!(el instanceof HTMLInputElement)) throw new Error(`no radio ${value}`);
  return el;
};
/** A pointer's click: `detail` 1, where a keyboard's synthetic click is 0. */
const tap = (el: Element) => {
  fireEvent.pointerDown(el);
  fireEvent.click(el, { detail: 1 });
};
/** Every channel control in document order, by its label. */
const channelOrder = () =>
  [...document.querySelectorAll("a[href^='tel:'], a[href^='sms:'], a[href*='wa.me'], summary, #quote-form")].map(el =>
    el.id === "quote-form" ? "form" : (el.textContent ?? ""),
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MONDAY_10H);
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("LeadCapture without a script", () => {
  it("is the plain form the funnel reads, posting to /quote", () => {
    document.body.innerHTML = renderToString(capture({ experiment: { name: "lead_layout", variant: "single" } }));
    const f = form();
    expect(f).toHaveAttribute("method", "post");
    expect(f).toHaveAttribute("action", "/quote");
    expect(posted()).toMatchObject({ location: "paris", locale: "fr", form_id: "quote", job: "leak", experiment: "lead_layout", variant: "single", hp_ref: "" });
    expect(f.querySelector("select[name=job]")).not.toBeNull();
    expect(f.querySelector("input[name=mobile]")).toHaveAttribute("type", "tel");
    expect(f.querySelector("input[name=mobile]")).toBeRequired();
  });

  // LEAD-FORMS-RETEST-2026-10-03 N2: without a script the 303 landed on the
  // card with no word of why. A page that reads its query hands the refusal
  // down (`leadErrorOf(searchParams)`), and the server draws it.
  it("draws a refusal the page hands down, at its field, with no script", () => {
    const fr = LEAD_CAPTURE_TEXT.fr;
    document.body.innerHTML = renderToString(capture({ initialError: leadErrorOf({ lead_error: "phone" }) }));
    expect(input("mobile")).toHaveAttribute("aria-invalid", "true");
    expect(input("mobile").closest("[role=group]")).toHaveTextContent(fr.phoneInvalid);
    document.body.innerHTML = renderToString(capture({ initialError: leadErrorOf({ lead_error: "consent" }) }));
    const callback = document.getElementById("quote-callback");
    expect(callback).toHaveAttribute("open");
    expect(callback).toHaveTextContent(fr.consentRequired);
    document.body.innerHTML = renderToString(capture({ initialError: leadErrorOf({ lead_error: "bedrooms" }) }));
    expect(form()).toHaveTextContent(fr.fieldInvalid);
    // Nothing to say, or a value that is not a field name: nothing drawn.
    expect(leadErrorOf({})).toBeNull();
    expect(leadErrorOf({ lead_error: "<b>" })).toBeNull();
    expect(leadErrorOf({ lead_error: ["phone", "x"] })).toEqual({ channel: "form", field: "phone" });
  });

  it("does not ask a need the page already knows", () => {
    document.body.innerHTML = renderToString(capture({ need: "boiler" }));
    expect(form().querySelector("select")).toBeNull();
    expect(posted()["job"]).toBe("boiler");
    expect(document.body.textContent).toContain("Chaudière");
  });

  it("qualify-first: a tile per need, and the contact step revealed by the checked one", () => {
    document.body.innerHTML = renderToString(capture({ layout: "qualify-first" }));
    const radios = form().querySelectorAll("input[type=radio][name=job]");
    expect(radios).toHaveLength(2);
    const contact = form().querySelector("input[name=mobile]")?.closest(".flex-col.gap-5");
    expect(contact?.className).toContain("group-has-[[data-need-option]:checked]/lead:flex");
    expect(contact?.className).toMatch(/(^| )hidden( |$)/);
  });

  it("posts a callback as its own small form with the channel marked", () => {
    document.body.innerHTML = renderToString(capture({ need: "leak" }));
    const callback = form("quote-callback-form");
    expect(posted("quote-callback-form")).toMatchObject({ channel: "callback", job: "leak", location: "paris" });
    const consent = callback.querySelector("input[type=checkbox]");
    expect(consent).toBeRequired();
    expect(consent).toHaveAttribute("name", "consent");
    expect(consent).toHaveAttribute("value", LEAD_CAPTURE_TEXT.fr.callbackConsent);
    expect(callback.querySelector("input[name=zip]")).toBeNull();
  });
});

describe("LeadCapture's channels", () => {
  it("puts the call first while the place is open, then the form, then the rest", () => {
    render(capture());
    expect(channelOrder()).toEqual(["Appeler", "form", "WhatsApp", "SMS", "Rappelez-moi"]);
    expect(screen.getByText("Rappelez-moi").closest("details")).not.toHaveAttribute("open");
  });

  it("opens the callback first when closed, promising the real next opening", () => {
    vi.setSystemTime(FRIDAY_20H);
    render(capture({ renderedAt: FRIDAY_20H }));
    expect(channelOrder()).toEqual(["Rappelez-moi", "form", "WhatsApp", "SMS", "Appeler"]);
    expect(screen.getByText("Rappelez-moi").closest("details")).toHaveAttribute("open");
    expect(screen.getByText("Nous vous rappelons lundi dès 8 h.")).toBeInTheDocument();
  });

  it("names the need in the WhatsApp and SMS messages", () => {
    render(capture({ need: "leak" }));
    const body = encodeURIComponent("Bonjour, j’ai besoin de : Fuite d’eau.");
    expect(screen.getByText("WhatsApp").closest("a")).toHaveAttribute("href", `https://wa.me/33612345678?text=${body}`);
    expect(screen.getByText("SMS").closest("a")).toHaveAttribute("href", `sms:+33612345678?&body=${body}`);
    expect(screen.getByText("SMS").closest("a")).toHaveAttribute("data-intent", "sms");
  });

  it("offers no call, text or WhatsApp to a place with no number, and still the callback", () => {
    render(capture({ contact: { phone: null, whatsapp: null } }));
    expect(document.querySelector("a[href^='tel:'], a[href^='sms:'], a[href*='wa.me']")).toBeNull();
    expect(channelOrder()).toEqual(["form", "Rappelez-moi"]);
  });

  it("follows the preferred channel of an experiment", () => {
    render(capture({ prefer: "form" }));
    expect(channelOrder()[0]).toBe("form");
  });
});

describe("LeadCapture with a script", () => {
  it("qualify-first: with the commune filled, the tap on a need lands on the phone", () => {
    render(capture({ layout: "qualify-first", place: { ...place, serviceArea: [{ kind: "localities", names: ["Royat"] }] } }));
    tap(radio("leak"));
    expect(document.activeElement).toBe(form().querySelector("input[name=mobile]"));
  });

  it("takes the need from ?need= and from a [data-need] trigger on the page", () => {
    window.history.replaceState(null, "", "/fr?need=boiler");
    const { unmount } = render(capture());
    expect(posted()["job"]).toBe("boiler");
    unmount();
    window.history.replaceState(null, "", "/fr");
    render(
      <>
        <a href="#quote" data-need="leak">
          Une fuite ?
        </a>
        {capture({ need: "boiler" })}
      </>,
    );
    fireEvent.click(screen.getByText("Une fuite ?"));
    expect(posted()["job"]).toBe("leak");
  });

  it("qualify-first: one tap on a need moves to the phone", () => {
    const { wrap, events } = recorder();
    render(wrap(capture({ layout: "qualify-first" })));
    tap(radio("boiler"));
    // Two communes served: the postcode is still to give, so it comes first.
    expect(document.activeElement).toBe(form().querySelector("input[name=zip]"));
    expect(posted()["job"]).toBe("boiler");
    expect(events.filter(e => e.event === "lead_form_step").map(e => e.props["step"])).toEqual(["contact"]);
    fireEvent.click(screen.getByText("Modifier"));
    expect(form().querySelectorAll("input[type=radio]")).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({ event: "lead_form_step", props: { step: "need" } });
  });

  it("fills the postcode from a tap on a served commune", () => {
    render(capture());
    fireEvent.click(screen.getByRole("button", { name: "Boulogne-Billancourt" }));
    expect(posted()["zip"]).toBe("Boulogne-Billancourt");
  });

  it("fills the commune of a place that serves one", () => {
    render(capture({ place: { ...place, serviceArea: [{ kind: "localities", names: ["Royat"] }] } }));
    expect(posted()["zip"]).toBe("Royat");
    expect(screen.queryByRole("group", { name: "Communes desservies" })).toBeNull();
  });

  it("hints at a number it cannot read when the visitor leaves it, in a region that is read out", () => {
    const { wrap, events } = recorder();
    render(wrap(capture()));
    const phone = input("mobile");
    const live = phone.closest("[role=group]")?.querySelector("[aria-live=polite]");
    expect(live).not.toBeNull();
    fireEvent.change(phone, { target: { value: "06 12" } });
    fireEvent.blur(phone);
    expect(live).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.phoneHint);
    expect(phone).toHaveAttribute("aria-invalid", "true");
    // A hint, not yet a refusal: told apart from the browser's block.
    expect(events.filter(e => e.event === "lead_form_field_error")).toEqual([{ event: "lead_form_field_error", props: expect.objectContaining({ field: "phone", blocking: false }) }]);
    fireEvent.change(phone, { target: { value: "06 12 34 56 78" } });
    expect(live).toBeEmptyDOMElement();
    expect(phone).not.toHaveAttribute("aria-invalid");
  });

  // LEAD-FORMS-RETEST-2026-10-03 N1: the hint drawn on the blur a tap on the
  // consent causes pushed the box down between press and release, and the
  // tap missed it. Any control, not only the submit.
  it("holds the hint a tap elsewhere causes until the tap is over, so nothing moves under it", async () => {
    render(capture());
    const phone = input("mobile", "quote-callback-form");
    const consent = form("quote-callback-form").querySelector<HTMLInputElement>("input[type=checkbox]");
    if (!consent) throw new Error("no consent");
    const live = phone.closest("[role=group]")?.querySelector("[aria-live=polite]");
    fireEvent.change(phone, { target: { value: "12 34 56 7" } });
    fireEvent.pointerDown(consent);
    fireEvent.blur(phone);
    expect(live).toBeEmptyDOMElement();
    fireEvent.pointerUp(consent);
    fireEvent.click(consent);
    expect(consent.checked).toBe(true);
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(live).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.phoneHint);
    // A press that turns into a scroll ends the wait as well.
    fireEvent.change(phone, { target: { value: "06 12 34 56 78" } });
    fireEvent.change(phone, { target: { value: "12 3" } });
    fireEvent.pointerDown(consent);
    fireEvent.blur(phone);
    expect(live).toBeEmptyDOMElement();
    fireEvent.pointerCancel(consent);
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(live).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.phoneHint);
    // From the keyboard nothing is under a pointer: the hint shows at once.
    fireEvent.change(phone, { target: { value: "06 12 34 56 78" } });
    fireEvent.change(phone, { target: { value: "12 34" } });
    fireEvent.blur(phone);
    expect(live).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.phoneHint);
  });

  // An empty message once gave back the field's gap with `-mt-2`, tuned to
  // the kit's `gap-2`: under a brand's other gap every field moved.
  it("keeps each field's empty message out of the layout, whatever the field's gap, and still read out", () => {
    render(capture({ name: { field: "name", required: true }, classNames: { field: "gap-1.5" } }));
    const zip = input("zip");
    const regions = [...form().querySelectorAll("[aria-live=polite]")].filter(el => el.closest("[role=group]"));
    expect(regions.length).toBeGreaterThanOrEqual(3);
    for (const region of regions) {
      expect(region).toBeEmptyDOMElement();
      // Out of the flex flow while empty, so no gap is added for it — and
      // never `hidden`: a region not rendered is not listened to.
      expect(region.className.split(" ")).toContain("empty:absolute");
      expect(region.className).not.toMatch(/(^|\s)(hidden|empty:hidden|empty:-?m[tby]?-)/);
    }
    const live = zip.closest("[role=group]")?.querySelector("[aria-live=polite]");
    act(() => void form().checkValidity());
    expect(live).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.required);
  });

  // LEAD-FORMS-REVIEW-2026-10-03 #1, #6, #14: the hint never blocked, the
  // callback had none, and the bubble spoke the browser's language.
  it("blocks a number the server would refuse, in both forms, in the page's words", () => {
    render(capture());
    for (const id of ["quote-form", "quote-callback-form"]) {
      const phone = input("mobile", id);
      for (const bad of ["06 12 34 56 7", "+3361234567", "0000000000", "(415) 555-0123"]) {
        fireEvent.change(phone, { target: { value: bad } });
        expect(phone.checkValidity(), `${id} ${bad}`).toBe(false);
        expect(phone.validationMessage).toBe(LEAD_CAPTURE_TEXT.fr.phoneInvalid);
      }
      fireEvent.change(phone, { target: { value: "+1 415 555 0123" } });
      expect(phone.checkValidity()).toBe(true);
      fireEvent.change(phone, { target: { value: "" } });
      expect(phone.validationMessage).toBe(LEAD_CAPTURE_TEXT.fr.required);
      act(() => void phone.checkValidity());
      expect(phone).toHaveAttribute("aria-invalid", "true");
    }
    expect(input("zip").validationMessage).toBe(LEAD_CAPTURE_TEXT.fr.required);
    expect(input("consent", "quote-callback-form").validationMessage).toBe(LEAD_CAPTURE_TEXT.fr.consentRequired);
  });

  it("speaks English on an English page", () => {
    render(capture({ locale: "en", text: LEAD_CAPTURE_TEXT.en }));
    fireEvent.change(input("mobile"), { target: { value: "06 12" } });
    expect(input("mobile").validationMessage).toBe(LEAD_CAPTURE_TEXT.en.phoneInvalid);
  });

  it("posts its own anchor, for the server to send a refusal back to", () => {
    render(capture({ id: "devis" }));
    expect(posted("devis-form")["card"]).toBe("devis");
    expect(posted("devis-callback-form")["card"]).toBe("devis");
  });

  // LEAD-FORMS-REVIEW-2026-10-03 #1: the no-JS refusal came back to an empty form with no word.
  it("shows the server's refusal at the field it names, focused, when the page is opened at it", () => {
    window.history.replaceState(null, "", "/fr?lead_error=phone&need=boiler#quote");
    render(capture());
    const phone = input("mobile");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.phoneInvalid);
    expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(phone.getAttribute("aria-describedby")).toContain(alert.id);
    expect(document.activeElement).toBe(phone);
    expect(posted()["job"]).toBe("boiler");
    // Read once: a reload does not show it again.
    expect(window.location.search).toBe("?need=boiler");
    fireEvent.input(phone, { target: { value: "06 12 34 56 78" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("opens the callback on its refusal, with the error at its field", () => {
    window.history.replaceState(null, "", "/fr?lead_error=consent#quote-callback");
    render(capture());
    expect(document.getElementById("quote-callback")).toHaveAttribute("open");
    const alert = within(form("quote-callback-form")).getByRole("alert");
    expect(alert).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.consentRequired);
    expect(document.activeElement).toBe(input("consent", "quote-callback-form"));
  });

  it("ignores a refusal meant for another card", () => {
    window.history.replaceState(null, "", "/fr?lead_error=phone#devis");
    render(capture());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("LeadCapture's qualify-first from the keyboard", () => {
  // LEAD-FORMS-REVIEW-2026-10-03 #7: the first arrow took the second need and left the group.
  it("arrow keys only move the choice; Enter, Space or a tap moves on", () => {
    const { wrap, events } = recorder();
    render(wrap(capture({ layout: "qualify-first" })));
    const steps = () => events.filter(e => e.event === "lead_form_step");
    act(() => radio("leak").focus());
    // What a browser does on ArrowDown in a group: a synthetic click (detail 0) on the next radio.
    fireEvent.keyDown(radio("leak"), { key: "ArrowDown" });
    act(() => radio("boiler").focus());
    fireEvent.click(radio("boiler"));
    expect(radio("boiler")).toBeChecked();
    expect(document.activeElement).toBe(radio("boiler"));
    expect(steps()).toEqual([]);
    fireEvent.keyDown(radio("boiler"), { key: "ArrowUp" });
    fireEvent.click(radio("leak"));
    expect(radio("leak")).toBeChecked();
    expect(steps()).toEqual([]);
    const enter = fireEvent.keyDown(radio("leak"), { key: "Enter" });
    // Enter would submit the form from a radio: it moves on instead.
    expect(enter).toBe(false);
    expect(document.activeElement).toBe(input("zip"));
    expect(posted()["job"]).toBe("leak");
    expect(steps().map(e => e.props["step"])).toEqual(["contact"]);
  });

  it("moves on with Space", () => {
    render(capture({ layout: "qualify-first" }));
    fireEvent.keyDown(radio("boiler"), { key: " " });
    fireEvent.keyUp(radio("boiler"), { key: " " });
    expect(document.activeElement).toBe(input("zip"));
    expect(posted()["job"]).toBe("boiler");
  });
});

describe("LeadCapture's events", () => {
  it("reports view, start and a refused field — tagged with the form, layout and experiment, never a value", () => {
    const { wrap, events } = recorder();
    render(wrap(capture({ experiment: { name: "lead_layout", variant: "single" } })));
    const phone = form().querySelector("input[name=mobile]");
    if (!(phone instanceof HTMLInputElement)) throw new Error("no phone");
    act(() => phone.focus());
    act(() => form("quote-callback-form").querySelector<HTMLInputElement>("input[name=mobile]")?.focus());
    fireEvent.change(phone, { target: { value: "0612345678" } });
    act(() => void form().checkValidity());
    const tags = { form_id: "quote", layout: "single", experiment: "lead_layout", variant: "single" };
    expect(events).toEqual([
      { event: "lead_form_view", props: tags },
      { event: "lead_form_start", props: tags },
      { event: "lead_form_field_error", props: { ...tags, field: "locality", blocking: true } },
    ]);
    expect(JSON.stringify(events)).not.toContain("0612345678");
  });

  it("is silent outside an analytics boundary", () => {
    expect(() => render(capture())).not.toThrow();
  });
});

describe("LeadCapture's locality field", () => {
  const zip = () => form().querySelector<HTMLInputElement>("input[name=zip]");

  it("fills a storefront's own postcode, on the numeric keypad", () => {
    render(capture({ place: storefrontPlace(["fr", "en"], { hours: WEEKDAYS }) }));
    expect(zip()).toHaveValue("63130");
    expect(zip()).toHaveAttribute("inputmode", "numeric");
    expect(zip()).toHaveAttribute("autocomplete", "postal-code");
  });

  it("takes letters when it is filled with a commune's name", () => {
    render(capture({ place: { ...place, serviceArea: [{ kind: "localities", names: ["Royat"] }] } }));
    expect(zip()).toHaveValue("Royat");
    expect(zip()).toHaveAttribute("inputmode", "text");
  });

  it("takes letters when its chips are names, before the script too", () => {
    document.body.innerHTML = renderToString(capture());
    expect(zip()).toHaveAttribute("inputmode", "text");
  });

  it("stays numeric when it is offered nothing to edit", () => {
    render(capture({ place: { ...place, serviceArea: [{ kind: "radius", center: { lat: 48.85, lng: 2.35 }, km: 20 }] } }));
    expect(zip()).toHaveValue("");
    expect(zip()).toHaveAttribute("inputmode", "numeric");
    document.body.innerHTML = "";
    const names = ["A", "B", "C", "D", "E", "F", "G"];
    render(capture({ place: { ...place, serviceArea: [{ kind: "localities", names }] } }));
    expect(screen.queryByRole("group", { name: "Communes desservies" })).toBeNull();
    expect(zip()).toHaveAttribute("inputmode", "numeric");
  });
});

describe("LeadCapture's anchor", () => {
  it("is the whole card, head included; the forms keep ids of their own", () => {
    document.body.innerHTML = renderToString(capture());
    const card = document.getElementById("quote");
    expect(card).toBeInstanceOf(HTMLDivElement);
    expect(card).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.title);
    expect(card?.contains(form("quote-form"))).toBe(true);
    expect(card?.contains(form("quote-callback-form"))).toBe(true);
    expect(document.getElementById("quote-callback")).toBeInstanceOf(HTMLDetailsElement);
  });

  it("follows the id it is given", () => {
    document.body.innerHTML = renderToString(capture({ id: "devis" }));
    expect(document.getElementById("devis")).toBeInstanceOf(HTMLDivElement);
    expect(posted("devis-form")).toMatchObject({ form_id: "quote" });
    expect(document.getElementById("devis-callback-form")).toBeInstanceOf(HTMLFormElement);
  });
});

describe("LeadCapture's parts", () => {
  const PARTS = { control: "brand-control", label: "brand-label", field: "brand-field" } as const;

  it("dresses the need's select with `control`, before and after the script", () => {
    document.body.innerHTML = renderToString(capture({ classNames: PARTS }));
    expect(form().querySelector("select[name=job]")).toHaveClass("brand-control");
    document.body.innerHTML = "";
    render(capture({ classNames: PARTS }));
    expect(screen.getByRole("combobox", { name: LEAD_CAPTURE_TEXT.fr.needLabel })).toHaveClass("brand-control");
  });

  it("dresses the callback's phone like the form's", () => {
    render(capture({ classNames: PARTS }));
    const callback = form("quote-callback-form");
    expect(callback.querySelector("input[name=mobile]")).toHaveClass("brand-control");
    expect(callback.querySelector("label")).toHaveClass("brand-label");
    expect(callback.querySelector("input[name=mobile]")?.parentElement).toHaveClass("brand-field");
  });

  it("dresses the callback through its own parts, after the channel's", () => {
    const parts = { channel: "brand-channel", callbackSummary: "brand-summary", callbackForm: "brand-form", callbackLede: "brand-lede", callbackSubmit: "brand-submit", consent: "brand-consent" };
    render(capture({ classNames: parts }));
    const summary = document.querySelector("summary");
    expect(summary).toHaveClass("brand-channel", "brand-summary");
    expect(form("quote-callback-form")).toHaveClass("brand-form");
    expect(screen.getByText(LEAD_CAPTURE_TEXT.fr.callbackLede)).toHaveClass("brand-lede");
    expect(screen.getByRole("button", { name: LEAD_CAPTURE_TEXT.fr.callbackSubmit })).toHaveClass("brand-submit");
  });

  it("closes the callback on a whole line: a block with its own line height, unless the brand sets one", () => {
    render(capture({ classNames: { channel: "text-[15px]" } }));
    expect(document.querySelector("summary")).toHaveClass("flex", "leading-6", "text-[15px]");
    expect(document.querySelector("summary")).not.toHaveClass("inline-flex");
    document.body.innerHTML = "";
    render(capture({ classNames: { callbackSummary: "text-[15px]/[22px]" } }));
    expect(document.querySelector("summary")).not.toHaveClass("leading-6");
  });
});

describe("LeadCapture's callback, opened or not", () => {
  const details = () => screen.getByText("Rappelez-moi").closest("details");

  it("opens where the brand says, whatever leads", () => {
    vi.setSystemTime(FRIDAY_20H);
    render(capture({ renderedAt: FRIDAY_20H, callbackOpen: false }));
    expect(details()).not.toHaveAttribute("open");
    // Still the channel that leads: the primary face.
    expect(details()?.querySelector("summary")?.className).toContain("bg-primary");
  });

  it("can start open while the form leads", () => {
    render(capture({ callbackOpen: true }));
    expect(details()).toHaveAttribute("open");
  });
});

describe("LeadCapture's placeholders and labels", () => {
  const text = { ...LEAD_CAPTURE_TEXT.fr, localityPlaceholder: "Code postal", phonePlaceholder: "06 12 34 56 78", namePlaceholder: "Votre nom" };

  it("shows the text's placeholders, none by default", () => {
    render(capture({ text, name: { field: "name" } }));
    expect(form().querySelector("input[name=zip]")).toHaveAttribute("placeholder", "Code postal");
    expect(form().querySelector("input[name=mobile]")).toHaveAttribute("placeholder", "06 12 34 56 78");
    expect(form().querySelector("input[name=name]")).toHaveAttribute("placeholder", "Votre nom");
    expect(form("quote-callback-form").querySelector("input[name=mobile]")).toHaveAttribute("placeholder", "06 12 34 56 78");
    document.body.innerHTML = "";
    render(capture());
    expect(document.querySelectorAll("input[placeholder]")).toHaveLength(0);
  });

  it("hides the labels from sight only: every field keeps its name", () => {
    render(capture({ text, labels: "hidden", name: { field: "name" }, classNames: { label: "brand-label" } }));
    const f = within(form());
    for (const label of [LEAD_CAPTURE_TEXT.fr.localityLabel, LEAD_CAPTURE_TEXT.fr.phoneLabel, `${LEAD_CAPTURE_TEXT.fr.nameLabel} (facultatif)`]) {
      expect(f.getByLabelText(label)).toBeInstanceOf(HTMLInputElement);
      expect(f.getByText(label)).toHaveClass("sr-only", "brand-label");
    }
    expect(f.getByRole("combobox", { name: LEAD_CAPTURE_TEXT.fr.needLabel })).toBeInTheDocument();
    expect(within(form("quote-callback-form")).getByLabelText(LEAD_CAPTURE_TEXT.fr.phoneLabel)).toBeInstanceOf(HTMLInputElement);
    expect(within(form("quote-callback-form")).getByText(LEAD_CAPTURE_TEXT.fr.phoneLabel)).toHaveClass("sr-only");
  });
});

describe("LeadCapture's in-card success", () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const thanks = () => json(200, { ok: true, location: "/fr/paris/thanks" });
  let submit: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
  });
  afterEach(() => {
    submit.mockRestore();
    vi.unstubAllGlobals();
  });

  async function send(id = "quote-form") {
    const f = form(id);
    for (const input of f.querySelectorAll<HTMLInputElement>("input[name=mobile], input[name=zip]")) fireEvent.change(input, { target: { value: input.name === "zip" ? "75011" : "06 12 34 56 78" } });
    await act(async () => {
      fireEvent.submit(f);
      await Promise.resolve();
    });
  }

  it("posts the form itself and shows the brand's state in place, focused", async () => {
    const fetch = vi.fn(async () => thanks());
    vi.stubGlobal("fetch", fetch);
    render(capture({ name: { field: "name" }, done: sent => <p>Merci, on rappelle le {sent.phone} ({sent.channel})</p> }));
    fireEvent.change(form().querySelector("input[name=name]") as HTMLInputElement, { target: { value: " Ana " } });
    await send();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/quote");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("accept")).toBe("application/json");
    expect(Object.fromEntries(init.body as URLSearchParams)).toMatchObject({ job: "leak", zip: "75011", mobile: "06 12 34 56 78", name: " Ana ", form_id: "quote" });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Merci, on rappelle le 06 12 34 56 78 (form)");
    expect(document.activeElement).toBe(status);
    expect(document.getElementById("quote")?.contains(status)).toBe(true);
    expect(document.getElementById("quote-form")).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });

  it("does the same for the callback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => thanks()));
    const done = vi.fn(() => "C’est noté.");
    render(capture({ done }));
    await send("quote-callback-form");
    expect(done).toHaveBeenCalledWith({ channel: "callback", phone: "06 12 34 56 78", name: null });
    expect(screen.getByRole("status")).toHaveTextContent("C’est noté.");
  });

  it("submits for real on an answer that is not the route's: the server's own page says why", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 500 })));
    render(capture({ done: "Merci" }));
    await send();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();
  });

  // LEAD-FORMS-REVIEW-2026-10-03 #4: offline, form.submit() opened the browser's error page and lost the form.
  it("does not resubmit when the network fails: it says so, keeps the form, and retries the same lead", async () => {
    const { wrap, events } = recorder();
    const fetch = vi.fn(async (): Promise<Response> => Promise.reject(new TypeError("Failed to fetch")));
    vi.stubGlobal("fetch", fetch);
    render(wrap(capture({ done: "Merci" })));
    await send();
    await act(async () => Promise.resolve());
    expect(submit).not.toHaveBeenCalled();
    const alert = within(form()).getByRole("alert");
    expect(alert).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.networkError);
    expect(posted()).toMatchObject({ zip: "75011", mobile: "06 12 34 56 78" });
    expect(events.filter(e => e.event === "lead_form_submit_error").map(e => e.props)).toEqual([expect.objectContaining({ reason: "network", channel: "form" })]);
    fetch.mockImplementation(async () => json(200, { ok: true, location: "/fr/paris/thanks" }));
    await act(async () => {
      fireEvent.click(within(alert).getByRole("button", { name: LEAD_CAPTURE_TEXT.fr.retry }));
      await Promise.resolve();
    });
    await act(async () => Promise.resolve());
    expect(fetch).toHaveBeenCalledTimes(2);
    const sid = (n: number) => Object.fromEntries((fetch.mock.calls[n] as unknown as [string, RequestInit])[1].body as URLSearchParams)["submission_id"];
    expect(sid(1)).toBe(sid(0));
    expect(screen.getByRole("status")).toHaveTextContent("Merci");
  });

  // LEAD-FORMS-REVIEW-2026-10-03 #5: a hung server left the card waiting forever, the button live.
  it("shows the busy state while sending, and gives up after the timeout with a retry", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"], now: MONDAY_10H });
    const hang = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
    );
    vi.stubGlobal("fetch", hang);
    render(capture());
    await send();
    const button = within(form()).getByRole("button", { name: LEAD_CAPTURE_TEXT.fr.sending });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    // The callback is its own form: still free.
    expect(within(form("quote-callback-form")).getByRole("button", { name: LEAD_CAPTURE_TEXT.fr.callbackSubmit })).toBeEnabled();
    await act(async () => {
      vi.advanceTimersByTime(SUBMIT_TIMEOUT_MS - 1);
      for (let i = 0; i < 5; i++) await Promise.resolve();
    });
    expect(within(form()).queryByRole("alert")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(1);
      for (let i = 0; i < 5; i++) await Promise.resolve();
    });
    expect(within(form()).getByRole("alert")).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.timeoutError);
    expect(within(form()).getByRole("button", { name: LEAD_CAPTURE_TEXT.fr.submit })).toBeEnabled();
    expect(submit).not.toHaveBeenCalled();
  });

  // LEAD-FORMS-REVIEW-2026-10-03 #3: the server can only dedupe what carries an id.
  it("posts one submission id per lead, the same on a retry", async () => {
    const fetch = vi.fn(async () => json(422, { ok: false, field: "phone" }));
    vi.stubGlobal("fetch", fetch);
    render(capture({ done: "Merci" }));
    await send();
    await act(async () => Promise.resolve());
    await send();
    await act(async () => Promise.resolve());
    const ids = fetch.mock.calls.map(c => Object.fromEntries((c as unknown as [string, RequestInit])[1].body as URLSearchParams)["submission_id"]);
    expect(ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(ids[1]).toBe(ids[0]);
    expect(posted("quote-callback-form")["submission_id"]).toBe("");
  });

  it("mints a new id for a lead changed after a failure, for the next lead, and never takes one the browser restored", async () => {
    const fetch = vi.fn(async (): Promise<Response> => Promise.reject(new TypeError("Failed to fetch")));
    vi.stubGlobal("fetch", fetch);
    const assign = vi.spyOn(navigation, "assign").mockImplementation(() => {});
    render(capture());
    // What Firefox puts back in a hidden field on Back.
    (form().elements.namedItem("submission_id") as HTMLInputElement).value = "restored-0000-0000-0000";
    const sid = (n: number) => Object.fromEntries((fetch.mock.calls[n] as unknown as [string, RequestInit])[1].body as URLSearchParams)["submission_id"];
    await send();
    await act(async () => Promise.resolve());
    expect(sid(0)).not.toBe("restored-0000-0000-0000");
    // The visitor fixes the number before retrying: another lead, which must not be answered with the first.
    fireEvent.change(input("mobile"), { target: { value: "07 12 34 56 78" } });
    await act(async () => {
      fireEvent.submit(form());
      await Promise.resolve();
    });
    await act(async () => Promise.resolve());
    expect(sid(1)).not.toBe(sid(0));
    fetch.mockImplementation(async () => json(200, { ok: true, location: "/fr/paris/thanks" }));
    await act(async () => {
      fireEvent.submit(form());
      await Promise.resolve();
    });
    await act(async () => Promise.resolve());
    expect(sid(2)).toBe(sid(1));
    assign.mockRestore();
  });

  it("takes an answer cut off mid-body as no answer, not as one to submit for real", async () => {
    const cut = { ok: true, status: 200, redirected: false, url: "", headers: new Headers({ "content-type": "application/json" }), json: () => Promise.reject(new TypeError("terminated")) };
    vi.stubGlobal("fetch", vi.fn(async () => cut));
    render(capture({ done: "Merci" }));
    await send();
    for (let i = 0; i < 3; i++) await act(async () => Promise.resolve());
    expect(submit).not.toHaveBeenCalled();
    expect(within(form()).getByRole("alert")).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.networkError);
  });

  it("goes to the thanks page without a `done`", async () => {
    const assign = vi.spyOn(navigation, "assign").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { ok: true, location: "/fr/paris/thanks?channel=callback" })));
    render(capture());
    await send("quote-callback-form");
    expect(assign).toHaveBeenCalledWith("/fr/paris/thanks?channel=callback");
    expect(submit).not.toHaveBeenCalled();
    assign.mockRestore();
  });

  // LEAD-FORMS-REVIEW-2026-10-03 #1: the refusal must not cost what was typed.
  it("shows a localized error and keeps the input when the server refuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(422, { ok: false, field: "phone" })));
    render(capture({ name: { field: "name" }, done: "Merci" }));
    fireEvent.change(input("name"), { target: { value: "Ana" } });
    await send();
    await act(async () => Promise.resolve());
    const alert = within(form()).getByRole("alert");
    expect(alert).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.phoneInvalid);
    expect(input("mobile")).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(input("mobile"));
    expect(posted()).toMatchObject({ zip: "75011", mobile: "06 12 34 56 78", name: "Ana" });
    expect(submit).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows a refusal of a brand's own field at the submit, the field marked", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(422, { ok: false, field: "bedrooms" })));
    render(capture({ extras: <input name="bedrooms" defaultValue="9" aria-label="Chambres" /> }));
    await send();
    await act(async () => Promise.resolve());
    expect(within(form()).getByRole("alert")).toHaveTextContent(LEAD_CAPTURE_TEXT.fr.fieldInvalid);
    expect(screen.getByLabelText("Chambres")).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(screen.getByLabelText("Chambres"));
  });
});
