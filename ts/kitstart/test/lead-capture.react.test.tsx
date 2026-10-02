import type { AnalyticsSink } from "@evinvest/analytics";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEAD_CAPTURE_TEXT, type OpeningHours, type Place } from "../src/index";
import { AnalyticsSinkContext } from "../src/react/analytics-context";
import { LeadCapture, type LeadCaptureProps } from "../src/react/index";
import { serviceAreaPlace } from "../src/testing/index";

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

const form = (id = "quote") => {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLFormElement)) throw new Error(`no form #${id}`);
  return el;
};
const posted = (id = "quote") => Object.fromEntries(new FormData(form(id)));
/** Every channel control in document order, by its label. */
const channelOrder = () =>
  [...document.querySelectorAll("a[href^='tel:'], a[href^='sms:'], a[href*='wa.me'], summary, #quote")].map(el =>
    el.id === "quote" ? "form" : (el.textContent ?? ""),
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
    expect(f.querySelector("input[name=zip]")).toHaveAttribute("inputmode", "numeric");
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
