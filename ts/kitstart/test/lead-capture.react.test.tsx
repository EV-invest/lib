import type { AnalyticsSink } from "@evinvest/analytics";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEAD_CAPTURE_TEXT, type OpeningHours, type Place } from "../src/index";
import { AnalyticsSinkContext } from "../src/react/analytics-context";
import { LeadCapture, type LeadCaptureProps } from "../src/react/index";
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
    fireEvent.click(screen.getByText("Fuite d’eau"));
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
    fireEvent.click(screen.getByText("Chaudière"));
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

  it("hints at a number it cannot read, without refusing it", () => {
    const { wrap, events } = recorder();
    render(wrap(capture()));
    const phone = form().querySelector("input[name=mobile]");
    if (!(phone instanceof HTMLInputElement)) throw new Error("no phone");
    fireEvent.change(phone, { target: { value: "06 12" } });
    fireEvent.blur(phone);
    expect(screen.getByText(LEAD_CAPTURE_TEXT.fr.phoneHint)).toBeInTheDocument();
    expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(phone.checkValidity()).toBe(true);
    expect(events.filter(e => e.event === "lead_form_field_error")).toEqual([{ event: "lead_form_field_error", props: expect.objectContaining({ field: "phone" }) }]);
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
      { event: "lead_form_field_error", props: { ...tags, field: "locality" } },
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
  const thanks = { ok: true, redirected: true, url: "http://localhost/fr/paris/thanks" };
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
    const fetch = vi.fn(async () => thanks);
    vi.stubGlobal("fetch", fetch);
    render(capture({ name: { field: "name" }, done: sent => <p>Merci, on rappelle le {sent.phone} ({sent.channel})</p> }));
    fireEvent.change(form().querySelector("input[name=name]") as HTMLInputElement, { target: { value: " Ana " } });
    await send();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/quote");
    expect(init.method).toBe("POST");
    expect(Object.fromEntries(init.body as URLSearchParams)).toMatchObject({ job: "leak", zip: "75011", mobile: "06 12 34 56 78", name: " Ana ", form_id: "quote" });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Merci, on rappelle le 06 12 34 56 78 (form)");
    expect(document.activeElement).toBe(status);
    expect(document.getElementById("quote")?.contains(status)).toBe(true);
    expect(document.getElementById("quote-form")).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });

  it("does the same for the callback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => thanks));
    const done = vi.fn(() => "C’est noté.");
    render(capture({ done }));
    await send("quote-callback-form");
    expect(done).toHaveBeenCalledWith({ channel: "callback", phone: "06 12 34 56 78", name: null });
    expect(screen.getByRole("status")).toHaveTextContent("C’est noté.");
  });

  it("submits for real on any other answer, or none", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, redirected: true, url: "http://localhost/fr/paris#quote" })));
    render(capture({ done: "Merci" }));
    await send();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await send();
    await act(async () => Promise.resolve());
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("leaves the form to the browser without a `done`", async () => {
    const fetch = vi.fn(async () => thanks);
    vi.stubGlobal("fetch", fetch);
    render(capture());
    let prevented: boolean | undefined;
    // Last on the way up, after React's: read what the form did, then keep
    // jsdom from navigating, which it cannot.
    const last = (e: Event) => {
      prevented = e.defaultPrevented;
      e.preventDefault();
    };
    window.addEventListener("submit", last);
    act(() => void form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    window.removeEventListener("submit", last);
    expect(prevented).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
