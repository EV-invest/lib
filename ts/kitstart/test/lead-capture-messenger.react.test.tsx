import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AnalyticsSink } from "@evinvest/analytics";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEAD_CAPTURE_MESSENGER_TEXT, LEAD_CAPTURE_TEXT, MESSAGE_REF, parsePricingModel, type MessengerFacts, type MessengerKind, type MessengerVariant } from "../src/index";
import { AnalyticsSinkContext } from "../src/react/analytics-context";
import { LeadCapture, type LeadCaptureProps } from "../src/react/index";
import { serviceAreaPlace } from "../src/testing/index";

const T = LEAD_CAPTURE_TEXT.fr;
const M = LEAD_CAPTURE_MESSENGER_TEXT.fr;
const WHATSAPP = "+33 6 12 34 56 78";
const BOT = "aquafix_devis_bot";
const BOTH: MessengerFacts = { whatsapp: WHATSAPP, telegram: BOT };
/** The first render of a variant waits for its chunk. */
const CHUNK = { timeout: 5000 };

const VARIANTS: Record<MessengerKind, MessengerVariant> = {
  select: { kind: "select", side: "prefix" },
  segment: { kind: "segment" },
  tiles: { kind: "tiles" },
  thanks: { kind: "thanks" },
  swap: { kind: "swap" },
  saga: { kind: "saga" },
  urgency: { kind: "urgency", field: "urgency" },
  sheet: { kind: "sheet" },
  chip: { kind: "chip" },
  split: { kind: "split" },
};

function card(kind: MessengerKind, over: Partial<LeadCaptureProps> = {}): ReactElement {
  return (
    <LeadCapture
      place={serviceAreaPlace(["fr", "en"])}
      contact={{ phone: WHATSAPP, whatsapp: WHATSAPP }}
      locale="fr"
      renderedAt={Date.now()}
      wire={{ subject: "job", locality: "zip", mobile: "mobile" }}
      needs={[{ value: "leak", label: "Fuite d’eau" }]}
      text={T}
      messenger={VARIANTS[kind]}
      messengers={BOTH}
      refPrefix="AQ"
      brand="Aquafix"
      {...over}
    />
  );
}

/** The sink the boundary would hand down, recording what it is told. */
function recorder() {
  const events: { event: string; props: Record<string, unknown> }[] = [];
  const sink: AnalyticsSink = { capture: (event, props) => void events.push({ event, props: { ...props } }) };
  return { events, wrap: (node: ReactElement) => <AnalyticsSinkContext.Provider value={sink}>{node}</AnalyticsSinkContext.Provider> };
}

const theForm = (): HTMLFormElement => {
  const el = document.getElementById("quote-form");
  if (!(el instanceof HTMLFormElement)) throw new Error("no form #quote-form");
  return el;
};
/** The reference the card holds now: the hidden field it posts. */
const currentRef = (): string => {
  const el = theForm().elements.namedItem("message_ref");
  if (!(el instanceof HTMLInputElement)) throw new Error("no message_ref field");
  return el.value;
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
/** What the n-th post sent, as fields. */
const body = (fetch: ReturnType<typeof vi.fn>, n = 0): Record<string, string> => {
  const call = fetch.mock.calls[n] as [string, RequestInit] | undefined;
  if (!call) throw new Error(`no post #${n}`);
  return Object.fromEntries(call[1].body as URLSearchParams);
};
const phone = (scope: HTMLElement = theForm()) => within(scope).getByRole("textbox", { name: T.phoneLabel });

/** The visitor leaves for the app and comes back. */
function leaveAndReturn() {
  for (const state of ["hidden", "visible"] as const) {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
  }
}

/** On a computer: a fine pointer that hovers. */
function desktop() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (media: string) => ({ matches: true, media, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }),
  });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
}

let fetch: ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
/** Whether each link click reached the window already prevented — the page itself never navigates under test. */
let prevented: boolean[];
const stopNavigation = (event: MouseEvent) => {
  if (!(event.target instanceof Element) || !event.target.closest("a[href^='https:']")) return;
  prevented.push(event.defaultPrevented);
  event.preventDefault();
};

/**
 * A tap as a browser runs it: the page's listeners, a microtask checkpoint
 * after each — React redraws there — and only then the link is followed, at
 * its href as it stands by then. jsdom follows before the microtasks; this
 * reads the href where the browser would. `null`: the tap was held back.
 */
async function tap(link: HTMLElement): Promise<string | null> {
  const before = prevented.length;
  fireEvent.click(link);
  await act(async () => {});
  return prevented[before] === false ? link.getAttribute("href") : null;
}

beforeEach(() => {
  fetch = vi.fn(async () => json(200, { ok: true, location: "/fr/paris/thanks" }));
  vi.stubGlobal("fetch", fetch);
  prevented = [];
  window.addEventListener("click", stopNavigation);
});
afterEach(() => {
  window.removeEventListener("click", stopNavigation);
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "visibilityState");
  Reflect.deleteProperty(window, "matchMedia");
  Reflect.deleteProperty(window, "innerWidth");
});

/** The control's form sent, for `thanks`: its success is where the messengers are. */
async function sendTheForm() {
  fireEvent.change(phone(theForm()), { target: { value: "06 12 34 56 78" } });
  fireEvent.change(within(theForm()).getByRole("textbox", { name: T.localityLabel }), { target: { value: "75011" } });
  await act(async () => {
    fireEvent.submit(theForm());
  });
  await screen.findByRole("status");
}

const pick = async (option: RegExp) => {
  fireEvent.click(await screen.findByRole("combobox", { name: M.messengerChannelLabel }, CHUNK));
  fireEvent.click(screen.getByRole("option", { name: option }));
};
const openSheet = async () => fireEvent.click(await screen.findByRole("button", { name: M.messengerSheetCta }, CHUNK));

/** How each variant leads to its WhatsApp button. */
const TO_WHATSAPP: Record<MessengerKind, () => Promise<HTMLElement>> = {
  select: () => screen.findByRole("link", { name: M.messengerWhatsappCta }, CHUNK),
  segment: () => screen.findByRole("link", { name: M.messengerWhatsappCta }, CHUNK),
  tiles: () => screen.findByRole("link", { name: M.messengerWhatsappCta }, CHUNK),
  thanks: async () => {
    await sendTheForm();
    return screen.findByRole("link", { name: M.messengerThanksCta }, CHUNK);
  },
  swap: () => screen.findByRole("link", { name: M.messengerWhatsappCta }, CHUNK),
  saga: async () => {
    fireEvent.click(await screen.findByRole("button", { name: /^WhatsApp/ }, CHUNK));
    return screen.findByRole("link", { name: M.messengerOpenWhatsapp }, CHUNK);
  },
  urgency: async () => {
    fireEvent.click(await screen.findByRole("button", { name: M.messengerUrgencyNo }, CHUNK));
    return screen.findByRole("link", { name: M.messengerWhatsappCta }, CHUNK);
  },
  sheet: async () => {
    await openSheet();
    return within(screen.getByRole("dialog")).getByRole("link", { name: /^WhatsApp/ });
  },
  chip: () => screen.findByRole("link", { name: M.messengerWhatsappCta }, CHUNK),
  split: () => screen.findByRole("link", { name: M.messengerSplitCta }, CHUNK),
};

/** How each variant leads to its Telegram button. */
const TO_TELEGRAM: Record<MessengerKind, () => Promise<HTMLElement>> = {
  select: async () => {
    await pick(/^Telegram/);
    return screen.getByRole("link", { name: M.messengerTelegramCta });
  },
  segment: () => screen.findByRole("link", { name: M.messengerViaTelegram }, CHUNK),
  tiles: async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Telegram" }, CHUNK));
    return screen.getByRole("link", { name: M.messengerTelegramCta });
  },
  thanks: async () => {
    await sendTheForm();
    return screen.findByRole("link", { name: M.messengerOptionTelegram }, CHUNK);
  },
  swap: () => screen.findByRole("link", { name: M.messengerOptionTelegram }, CHUNK),
  saga: async () => {
    fireEvent.click(await screen.findByRole("button", { name: /^Telegram/ }, CHUNK));
    return screen.findByRole("link", { name: M.messengerTelegramCta }, CHUNK);
  },
  urgency: () => screen.findByRole("link", { name: M.messengerViaTelegram }, CHUNK),
  sheet: async () => {
    await openSheet();
    return within(screen.getByRole("dialog")).getByRole("link", { name: /^Telegram/ });
  },
  chip: async () => {
    await pick(/^Telegram/);
    return screen.getByRole("link", { name: M.messengerTelegramCta });
  },
  split: () => screen.findByRole("link", { name: M.messengerOptionTelegram }, CHUNK),
};

/** How each variant turns to a call: the phone field it then asks, and the submit that posts it. */
const TO_CALL: Record<Exclude<MessengerKind, "thanks">, () => Promise<{ field: HTMLElement; submit: HTMLElement }>> = {
  select: async () => {
    await pick(/^Appel/);
    return { field: phone(), submit: within(theForm()).getByRole("button", { name: T.submit }) };
  },
  segment: async () => {
    fireEvent.click(await screen.findByRole("button", { name: M.messengerOptionCall }, CHUNK));
    return { field: phone(), submit: within(theForm()).getByRole("button", { name: T.submit }) };
  },
  tiles: async () => {
    fireEvent.click(await screen.findByRole("button", { name: M.messengerOptionCall }, CHUNK));
    return { field: phone(), submit: within(theForm()).getByRole("button", { name: T.submit }) };
  },
  swap: async () => {
    fireEvent.click(await within(theForm()).findByRole("button", { name: M.messengerCallback }, CHUNK));
    return { field: phone(), submit: within(theForm()).getByRole("button", { name: T.submit }) };
  },
  saga: async () => {
    fireEvent.click(await screen.findByRole("button", { name: /^Appel/ }, CHUNK));
    return { field: await within(theForm()).findByRole("textbox", { name: T.phoneLabel }, CHUNK), submit: within(theForm()).getByRole("button", { name: T.submit }) };
  },
  urgency: async () => {
    fireEvent.click(await screen.findByRole("button", { name: M.messengerUrgencyYes }, CHUNK));
    return { field: phone(), submit: within(theForm()).getByRole("button", { name: M.messengerUrgentSubmit }) };
  },
  sheet: async () => {
    await openSheet();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Appel/ }));
    const dialog = screen.getByRole("dialog");
    return { field: phone(dialog), submit: within(dialog).getByRole("button", { name: M.messengerCallback }) };
  },
  chip: async () => {
    await pick(/^Appel/);
    return { field: phone(), submit: within(theForm()).getByRole("button", { name: T.submit }) };
  },
  split: async () => {
    fireEvent.click(await within(theForm()).findByRole("button", { name: M.messengerCallback }, CHUNK));
    return { field: phone(), submit: within(theForm()).getByRole("button", { name: M.messengerCallback }) };
  },
};

const KINDS = Object.keys(VARIANTS) as MessengerKind[];
const LEAD_FIRST = KINDS.filter((k): k is Exclude<MessengerKind, "thanks"> => k !== "thanks");

/** The timing line a variant writes into the message: `urgency`'s «je compare» is a need that can wait. */
const TIMING_LINE: Record<MessengerKind, readonly string[]> = {
  select: [],
  segment: [],
  tiles: [],
  thanks: [],
  swap: [],
  saga: [],
  urgency: ["Délai souhaité : pas pressé"],
  sheet: [],
  chip: [],
  split: [],
};

/**
 * A messenger button reached, with the reference the card held and the link
 * it drew before the tap — a tap mints the next reference and redraws the link.
 */
async function reach(go: () => Promise<HTMLElement>): Promise<{ link: HTMLElement; ref: string; href: string }> {
  await waitFor(() => expect(currentRef()).toMatch(MESSAGE_REF), CHUNK);
  const ref = currentRef();
  const link = await go();
  return { link, ref, href: link.getAttribute("href") ?? "" };
}

/** Where a variant asks the phone of a call: the drawer for the sheet, the card's form otherwise. */
const CALL_SCOPE: Record<Exclude<MessengerKind, "thanks">, () => HTMLElement> = {
  select: theForm,
  segment: theForm,
  tiles: theForm,
  swap: theForm,
  saga: theForm,
  urgency: theForm,
  sheet: () => screen.getByRole("dialog"),
  chip: theForm,
  split: theForm,
};

describe.each(KINDS)("the %s variant", kind => {
  it("draws, tagged with the messengers it offers, and mints a reference", async () => {
    render(card(kind));
    const { ref } = await reach(TO_WHATSAPP[kind]);
    expect(document.getElementById("quote")).toHaveAttribute("data-channels-available", "wa,tg");
    expect(ref).toMatch(/^AQ-[0-9A-HJKMNP-TV-Z]{4}$/);
  });

  it("sends the visitor to WhatsApp with the message and its reference", async () => {
    render(card(kind));
    const { ref, href } = await reach(TO_WHATSAPP[kind]);
    expect(new URL(href).host).toBe("wa.me");
    expect(new URL(href).pathname).toBe("/33612345678");
    expect(new URL(href).searchParams.get("text")?.split("\n")).toEqual(["Bonjour Aquafix 👋", "Je souhaite un devis : Fuite d’eau", ...TIMING_LINE[kind], `Réf. ${ref}`]);
  });

  it("sends the visitor to the bot with the reference as its start", async () => {
    render(card(kind));
    const { ref, href } = await reach(TO_TELEGRAM[kind]);
    expect(href).toBe(`https://t.me/${BOT}?start=${ref}`);
  });

  it("draws no Telegram at all when the place has no bot", async () => {
    render(card(kind, { messengers: { whatsapp: WHATSAPP, telegram: null } }));
    await reach(TO_WHATSAPP[kind]);
    expect(document.getElementById("quote")).toHaveAttribute("data-channels-available", "wa");
    expect(document.querySelector("a[href*='t.me']")).toBeNull();
    expect(screen.queryByText(/Telegram/)).toBeNull();
  });
});

describe.each(LEAD_FIRST)("the %s variant, tapped", kind => {
  it("posts the lead in the background — keepalive, its channel and the reference the link carries", async () => {
    render(card(kind));
    const { link, ref, href } = await reach(TO_WHATSAPP[kind]);
    fireEvent.click(link);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(new URL(url ?? "").pathname).toBe("/quote");
    expect(init).toMatchObject({ method: "POST", keepalive: true });
    expect(body(fetch)).toMatchObject({ channel: "whatsapp", message_ref: ref, job: "leak", channels_available: "wa,tg", form_id: "quote" });
    expect(new URL(href).searchParams.get("text")).toContain(`Réf. ${ref}`);
    // The app opens from the tap itself: the link is not held back.
    expect(prevented).toEqual([false]);
  });

  it("posts a Telegram lead the same way, under the reference its start carries", async () => {
    render(card(kind));
    const { link, ref, href } = await reach(TO_TELEGRAM[kind]);
    fireEvent.click(link);
    expect(body(fetch)).toMatchObject({ channel: "telegram", message_ref: ref });
    expect(href).toBe(`https://t.me/${BOT}?start=${ref}`);
  });

  it("asks, back from the chat, whether it went — and a failure turns the card to a call, the phone focused", async () => {
    const { wrap, events } = recorder();
    render(wrap(card(kind)));
    const { link, ref, href } = await reach(TO_WHATSAPP[kind]);
    fireEvent.click(link);
    leaveAndReturn();
    const back = await screen.findByRole("status");
    expect(back).toHaveTextContent(M.messengerReturnTitle);
    expect(back).toHaveTextContent(`Si oui, on vous répond sur WhatsApp rapidement, référence ${ref}.`);
    expect(within(back).getByRole("link", { name: "Rouvrir WhatsApp" })).toHaveAttribute("href", href);
    fireEvent.click(within(back).getByRole("button", { name: M.messengerReturnFailed }));
    expect(screen.queryByText(M.messengerReturnTitle)).toBeNull();
    await waitFor(() => expect(phone(CALL_SCOPE[kind]())).toHaveFocus());
    expect(events.find(e => e.event === "lead_messenger_return")?.props).toMatchObject({
      channel: "whatsapp",
      answer: "failed",
      message_ref: ref,
      channels_available: "wa,tg",
      messenger_variant: kind,
    });
  });

  it("turns to a call: the phone required, posted as the control posts it", async () => {
    render(card(kind));
    const { field, submit } = await TO_CALL[kind]();
    expect(field).toBeRequired();
    fireEvent.change(field, { target: { value: "06 12 34 56 78" } });
    fireEvent.change(within(theForm()).getByRole("textbox", { name: T.localityLabel }), { target: { value: "75011" } });
    await act(async () => {
      fireEvent.click(submit);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(body(fetch)).toMatchObject({ mobile: "06 12 34 56 78", zip: "75011", job: "leak" });
    expect(body(fetch)["channel"]).toBeUndefined();
  });

  it("shows a QR code on a computer instead of leaving the page for WhatsApp", async () => {
    desktop();
    const { wrap, events } = recorder();
    render(wrap(card(kind)));
    const { link, href } = await reach(TO_WHATSAPP[kind]);
    fireEvent.click(link);
    expect(prevented).toEqual([true]);
    const qr = await screen.findByRole("img", { name: M.messengerQrAlt }, CHUNK);
    await waitFor(() => expect(qr.querySelector("path")).not.toBeNull(), CHUNK);
    expect(screen.getByRole("link", { name: M.messengerQrWeb })).toHaveAttribute("href", href);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(events.find(e => e.event === "lead_messenger_open")?.props).toMatchObject({ channel: "whatsapp", device: "desktop", inapp: false });
    expect(events.find(e => e.event === "contact_intent_click")?.props).toMatchObject({ channel: "whatsapp_qr" });
  });
});

/** The same WhatsApp button, once more: still on the card — or, for the sheet, in its drawer opened again. */
const TAP_AGAIN: Record<Exclude<MessengerKind, "thanks">, (first: HTMLElement) => Promise<HTMLElement>> = {
  select: async first => first,
  segment: async first => first,
  tiles: async first => first,
  swap: async first => first,
  saga: async first => first,
  urgency: async first => first,
  sheet: async () => {
    await openSheet();
    return within(screen.getByRole("dialog")).getByRole("link", { name: /^WhatsApp/ });
  },
  chip: async first => first,
  split: async first => first,
};

// Found on the stand: the lead was AQ-W18C, and the tap opened t.me start=AQ-P3BV —
// the link was redrawn under the next reference before the browser followed it.
describe.each(LEAD_FIRST)("the %s variant, what leaves with the tap", kind => {
  it("opens WhatsApp under the reference it posted, and the return screen and «Rouvrir» say that one", async () => {
    render(card(kind));
    const { link, ref, href } = await reach(TO_WHATSAPP[kind]);
    const opened = await tap(link);
    expect(body(fetch)["message_ref"]).toBe(ref);
    expect(opened).toBe(href);
    expect(new URL(opened ?? "").searchParams.get("text")).toContain(`Réf. ${ref}`);
    leaveAndReturn();
    const back = await screen.findByRole("status");
    expect(back).toHaveTextContent(`référence ${ref}.`);
    expect(within(back).getByRole("link", { name: "Rouvrir WhatsApp" })).toHaveAttribute("href", href);
  });

  it("opens the bot under the reference it posted", async () => {
    render(card(kind));
    const { link, ref } = await reach(TO_TELEGRAM[kind]);
    const opened = await tap(link);
    expect(body(fetch)["message_ref"]).toBe(ref);
    expect(opened).toBe(`https://t.me/${BOT}?start=${ref}`);
  });

  it("draws the QR code on a computer under the reference it posted", async () => {
    desktop();
    render(card(kind));
    const { link, ref, href } = await reach(TO_WHATSAPP[kind]);
    expect(await tap(link)).toBeNull();
    expect(body(fetch)["message_ref"]).toBe(ref);
    await screen.findByRole("img", { name: M.messengerQrAlt }, CHUNK);
    expect(screen.getByRole("link", { name: M.messengerQrWeb })).toHaveAttribute("href", href);
    expect(new URL(href).searchParams.get("text")).toContain(`Réf. ${ref}`);
  });

  it("is one lead for two taps with nothing changed: the same reference and submission id", async () => {
    render(card(kind));
    const { link, ref, href } = await reach(TO_WHATSAPP[kind]);
    const first = await tap(link);
    const second = await tap(await TAP_AGAIN[kind](link));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(body(fetch, 1)["submission_id"]).toBe(body(fetch, 0)["submission_id"]);
    expect(body(fetch, 1)["message_ref"]).toBe(ref);
    expect([first, second]).toEqual([href, href]);
  });
});

describe.each(LEAD_FIRST.filter(k => k !== "urgency"))("the %s variant without WhatsApp", kind => {
  it("is the control, with the bot under the submit", async () => {
    render(card(kind, { messengers: { whatsapp: null, telegram: BOT } }));
    const bot = await screen.findByRole("link", { name: M.messengerViaTelegram }, CHUNK);
    expect(document.getElementById("quote")).toHaveAttribute("data-channels-available", "tg");
    expect(phone()).toBeRequired();
    expect(within(theForm()).getByRole("button", { name: T.submit })).toBeInTheDocument();
    expect(document.querySelector("a[href*='wa.me'][href*='R%C3%A9f.']")).toBeNull();
    expect(bot).toHaveAttribute("href", `https://t.me/${BOT}?start=${currentRef()}`);
  });
});

describe("the urgency variant without WhatsApp", () => {
  it("keeps its question, and both answers ask the phone", async () => {
    render(card("urgency", { messengers: { whatsapp: null, telegram: BOT } }));
    fireEvent.click(await screen.findByRole("button", { name: M.messengerUrgencyNo }, CHUNK));
    expect(phone()).toBeRequired();
    fireEvent.click(screen.getByRole("button", { name: M.messengerUrgencyYes }));
    expect(phone()).toBeRequired();
    expect(screen.getByRole("link", { name: M.messengerViaTelegram })).toBeInTheDocument();
    expect(document.querySelector("a[href*='wa.me'][href*='R%C3%A9f.']")).toBeNull();
  });
});

describe("a variant with neither messenger", () => {
  it("is the control as it is: no reference, no messenger link", () => {
    render(card("segment", { messengers: { whatsapp: null, telegram: null } }));
    expect(document.getElementById("quote")).toHaveAttribute("data-channels-available", "none");
    expect(theForm().elements.namedItem("message_ref")).toBeNull();
    expect(document.querySelector("a[href*='t.me'], a[href*='wa.me'][href*='R%C3%A9f.']")).toBeNull();
  });
});

describe("the select variant's optional phone", () => {
  it("refuses a typed number that is not one, and posts nothing", async () => {
    render(card("select"));
    const { link } = await reach(TO_WHATSAPP.select);
    fireEvent.change(theForm().elements.namedItem("mobile") as HTMLInputElement, { target: { value: "06 12" } });
    fireEvent.click(link);
    expect(fetch).not.toHaveBeenCalled();
    expect(prevented).toEqual([true]);
  });

  // The field's label must name the field, not the channel picker beside it.
  it("is the field its label names", async () => {
    render(card("select"));
    await reach(TO_WHATSAPP.select);
    expect(within(theForm()).getByLabelText(T.phoneLabel)).toHaveAttribute("name", "mobile");
    expect(within(theForm()).getByRole("textbox", { name: T.phoneLabel })).not.toBeRequired();
  });

  it("is switched off for Telegram, which needs no number", async () => {
    render(card("select"));
    await reach(TO_TELEGRAM.select);
    expect(theForm().elements.namedItem("mobile")).toBeDisabled();
  });
});

describe("the urgency variant's answer", () => {
  it("is posted as the brand's extra: later with WhatsApp", async () => {
    render(card("urgency"));
    const { link } = await reach(TO_WHATSAPP.urgency);
    fireEvent.click(link);
    expect(body(fetch)).toMatchObject({ urgency: "later", channel: "whatsapp" });
  });

  it("is posted as the brand's extra: today with a call", async () => {
    render(card("urgency"));
    const { field, submit } = await TO_CALL.urgency();
    fireEvent.change(field, { target: { value: "06 12 34 56 78" } });
    fireEvent.change(within(theForm()).getByRole("textbox", { name: T.localityLabel }), { target: { value: "75011" } });
    await act(async () => {
      fireEvent.click(submit);
    });
    expect(body(fetch)).toMatchObject({ urgency: "today", mobile: "06 12 34 56 78" });
  });
});

describe("the sheet variant's drawer", () => {
  it("is a dialog named by its heading, on either step", async () => {
    render(card("sheet"));
    await openSheet();
    expect(screen.getByRole("dialog", { name: M.messengerSheetTitle })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Appel/ }));
    expect(screen.getByRole("dialog", { name: M.messengerCallTitle })).toBeInTheDocument();
  });
});

describe("the sheet variant's call", () => {
  it("asks the phone in the drawer, a field of the card's form", async () => {
    render(card("sheet"));
    const { field, submit } = await TO_CALL.sheet();
    expect(field).toHaveAttribute("form", "quote-form");
    expect(submit).toHaveAttribute("form", "quote-form");
    expect(theForm().contains(field)).toBe(false);
    fireEvent.change(field, { target: { value: "06 12 34 56 78" } });
    expect(new FormData(theForm()).get("mobile")).toBe("06 12 34 56 78");
  });
});

describe("the thanks variant", () => {
  it("offers WhatsApp after the form, under the lead's own reference, without a second post", async () => {
    render(card("thanks"));
    const { link, ref, href } = await reach(TO_WHATSAPP.thanks);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(body(fetch)).toMatchObject({ message_ref: ref });
    expect(screen.getByText(M.messengerThanksTitle)).toBeInTheDocument();
    expect(new URL(href).searchParams.get("text")).toContain(`Réf. ${ref}`);
    fireEvent.click(link);
    leaveAndReturn();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(M.messengerReturnTitle)).toBeNull();
    expect(screen.getByRole("link", { name: M.messengerOptionTelegram })).toHaveAttribute("href", `https://t.me/${BOT}?start=${ref}`);
  });

  it("shows the QR code in the success on a computer", async () => {
    desktop();
    render(card("thanks"));
    await sendTheForm();
    const qr = await screen.findByRole("img", { name: M.messengerQrAlt }, CHUNK);
    await waitFor(() => expect(qr.querySelector("path")).not.toBeNull(), CHUNK);
    expect(screen.queryByRole("link", { name: M.messengerThanksCta })).toBeNull();
  });

  it("keeps its bot in the success when the place has no WhatsApp", async () => {
    render(card("thanks", { messengers: { whatsapp: null, telegram: BOT } }));
    const { href } = await reach(TO_TELEGRAM.thanks);
    expect(href).toMatch(/^https:\/\/t\.me\/aquafix_devis_bot\?start=AQ-/);
    expect(screen.queryByRole("link", { name: M.messengerThanksCta })).toBeNull();
  });
});

describe("the WhatsApp message", () => {
  it("never carries the phone typed, which goes with the post only", async () => {
    render(card("select"));
    await reach(TO_WHATSAPP.select);
    fireEvent.change(theForm().elements.namedItem("mobile") as HTMLInputElement, { target: { value: "06 98 76 54 32" } });
    fireEvent.change(within(theForm()).getByRole("textbox", { name: T.localityLabel }), { target: { value: "75011" } });
    const link = screen.getByRole("link", { name: M.messengerWhatsappCta });
    fireEvent.click(link);
    const sent = new URL(link.getAttribute("href") ?? "").searchParams.get("text");
    expect(sent).toContain("Code postal : 75011");
    expect(sent).not.toMatch(/98 76|987654/);
    expect(body(fetch)).toMatchObject({ mobile: "06 98 76 54 32" });
  });

  it("keeps its reference until the visitor answers the return screen, then draws a new one", async () => {
    render(card("segment"));
    const { link, ref } = await reach(TO_WHATSAPP.segment);
    fireEvent.click(link);
    expect(currentRef()).toBe(ref);
    leaveAndReturn();
    const back = await screen.findByRole("status");
    expect(currentRef()).toBe(ref);
    fireEvent.click(within(back).getByRole("button", { name: M.messengerReturnDone }));
    await waitFor(() => expect(currentRef()).not.toBe(ref));
    expect(currentRef()).toMatch(MESSAGE_REF);
    const again = new URL(screen.getByRole("link", { name: M.messengerWhatsappCta }).getAttribute("href") ?? "");
    expect(again.searchParams.get("text")).toContain(`Réf. ${currentRef()}`);
  });

  it("draws a new reference after «Je n’ai pas pu envoyer» too: the call is another lead", async () => {
    render(card("segment"));
    const { link, ref } = await reach(TO_WHATSAPP.segment);
    fireEvent.click(link);
    leaveAndReturn();
    fireEvent.click(within(await screen.findByRole("status")).getByRole("button", { name: M.messengerReturnFailed }));
    await waitFor(() => expect(currentRef()).not.toBe(ref));
  });
});

describe("the parts a brand dresses a variant with", () => {
  const PARTS = {
    messengerCta: "x-cta",
    messengerSecondary: "x-secondary",
    messengerSegment: "x-segment",
    messengerTile: "x-tile",
    messengerTrigger: "x-trigger",
    messengerSquare: "x-square",
  };

  it("dresses the main button and the secondary ones, and the call's submit as the main one", async () => {
    render(card("segment", { classNames: PARTS }));
    expect(await screen.findByRole("link", { name: M.messengerWhatsappCta }, CHUNK)).toHaveClass("x-cta");
    expect(screen.getByRole("link", { name: M.messengerViaTelegram })).toHaveClass("x-secondary");
    expect(screen.getByRole("button", { name: M.messengerOptionWhatsapp })).toHaveClass("x-segment");
    fireEvent.click(screen.getByRole("button", { name: M.messengerOptionCall }));
    expect(screen.getByRole("button", { name: M.messengerOptionCall })).toHaveClass("x-segment");
    expect(within(theForm()).getByRole("button", { name: T.submit })).toHaveClass("x-cta");
  });

  it("dresses a tile, and urgency's answers as tiles", async () => {
    render(card("tiles", { classNames: PARTS }));
    expect(await screen.findByRole("button", { name: "Telegram" }, CHUNK)).toHaveClass("x-tile");
    expect(screen.getByRole("button", { name: M.messengerOptionCall })).toHaveClass("x-tile");
    render(card("urgency", { id: "urgent", classNames: PARTS }));
    expect(await screen.findByRole("button", { name: M.messengerUrgencyYes }, CHUNK)).toHaveClass("x-tile");
    expect(screen.getByRole("button", { name: M.messengerUrgencyNo })).toHaveClass("x-tile");
  });

  it("dresses the channel picker's button, in the phone field and as the chip", async () => {
    render(card("select", { classNames: PARTS }));
    expect(await screen.findByRole("combobox", { name: M.messengerChannelLabel }, CHUNK)).toHaveClass("x-trigger");
    render(card("chip", { id: "chip", classNames: PARTS }));
    await waitFor(() => expect(screen.getAllByRole("combobox", { name: M.messengerChannelLabel })).toHaveLength(2), CHUNK);
    expect(screen.getAllByRole("combobox", { name: M.messengerChannelLabel })[1]).toHaveClass("x-trigger");
  });

  it("dresses the buttons beside the main one: Telegram and the call in swap, the squares in split", async () => {
    render(card("swap", { classNames: PARTS }));
    expect(await within(theForm()).findByRole("link", { name: M.messengerOptionTelegram }, CHUNK)).toHaveClass("x-secondary");
    expect(within(theForm()).getByRole("button", { name: M.messengerCallback })).toHaveClass("x-secondary");
    render(card("split", { id: "split", classNames: PARTS }));
    const split = await waitFor(() => {
      const el = document.getElementById("split-form");
      if (!(el instanceof HTMLFormElement)) throw new Error("no form #split-form");
      return within(el).getByRole("button", { name: M.messengerCallback });
    }, CHUNK);
    expect(split).toHaveClass("x-square");
  });

  it("dresses the sheet's one button and the return screen's two", async () => {
    render(card("sheet", { classNames: PARTS }));
    expect(await screen.findByRole("button", { name: M.messengerSheetCta }, CHUNK)).toHaveClass("x-cta");
    const { link } = await reach(TO_WHATSAPP.sheet);
    fireEvent.click(link);
    leaveAndReturn();
    const back = await screen.findByRole("status");
    expect(within(back).getByRole("link", { name: "Rouvrir WhatsApp" })).toHaveClass("x-secondary");
    expect(within(back).getByRole("button", { name: M.messengerReturnFailed })).toHaveClass("x-cta");
  });
});

describe("the brand's channel icons on a variant", () => {
  // The icons are drawn `aria-hidden`, beside the words that name the button: no role or name reaches them.
  const icon = (name: string) => <svg data-testid={`icon-${name}`} />;
  const ICONS = { whatsapp: icon("whatsapp"), telegram: icon("telegram"), phone: icon("phone"), callback: icon("callback") };

  it("puts each channel's icon on its button, and the phone's on the call's submit", async () => {
    render(card("segment", { channelIcons: ICONS }));
    const whatsapp = await screen.findByRole("link", { name: M.messengerWhatsappCta }, CHUNK);
    expect(within(whatsapp).getByTestId("icon-whatsapp")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: M.messengerViaTelegram })).getByTestId("icon-telegram")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: M.messengerOptionCall }));
    const submit = within(theForm()).getByRole("button", { name: T.submit });
    expect(within(submit).getByTestId("icon-phone")).toBeInTheDocument();
    expect(within(submit).queryByTestId("icon-callback")).toBeNull();
  });

  it("falls back to the callback's icon for the call when the brand drew no phone", async () => {
    render(card("split", { channelIcons: { callback: icon("callback") } }));
    const square = await within(theForm()).findByRole("button", { name: M.messengerCallback }, CHUNK);
    expect(within(square).getByTestId("icon-callback")).toBeInTheDocument();
    fireEvent.click(square);
    expect(within(within(theForm()).getByRole("button", { name: M.messengerCallback })).getByTestId("icon-callback")).toBeInTheDocument();
  });
});

describe("the swap variant on a computer", () => {
  it("says «Ouvrir Telegram» beside the QR code's slot", async () => {
    desktop();
    render(card("swap"));
    expect(await within(theForm()).findByRole("link", { name: M.messengerTelegramCta }, CHUNK)).toHaveAttribute("href", expect.stringMatching(/^https:\/\/t\.me\//));
    expect(within(theForm()).queryByRole("link", { name: M.messengerOptionTelegram })).toBeNull();
  });
});

describe("an estimate's answers in the message", () => {
  const MODEL = parsePricingModel(JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/pricing/valid/cleaning.json"), "utf8")));
  const estimate = (over: Partial<LeadCaptureProps> = {}) =>
    card("segment", {
      needs: [{ value: "standard", label: "Ménage courant" }],
      flows: { standard: "estimate" },
      pricing: MODEL,
      questions: { bedrooms: { shortLabels: { t3: "2 ch." } }, frequency: { unknown: true, shortLabels: { biweekly: "2 sem." } } },
      messengerTiming: { input: "frequency" },
      ...over,
    });
  const answer = (input: string, option: string) => {
    const el = theForm().querySelector(`input[name=estimate_${input}][value="${option}"]`);
    if (!(el instanceof HTMLInputElement)) throw new Error(`no answer ${input}=${option}`);
    fireEvent.click(el);
  };
  const sent = () => new URL(screen.getByRole("link", { name: M.messengerWhatsappCta }).getAttribute("href") ?? "").searchParams.get("text")?.split("\n");

  it("says the need with its answers, the timing on a line of its own, and the estimate", async () => {
    render(estimate());
    const { ref } = await reach(TO_WHATSAPP.segment);
    answer("zone", "proche");
    answer("bedrooms", "t3");
    answer("surface", "s70");
    answer("frequency", "biweekly");
    expect(sent()).toEqual([
      "Bonjour Aquafix 👋",
      "Je souhaite un devis : Ménage courant · Proche banlieue · 2 ch. · 40 à 70 m²",
      expect.stringMatching(/^Estimation vue sur le site : 84\s€$/u),
      "Délai souhaité : Toutes les 2 semaines",
      `Réf. ${ref}`,
    ]);
    // The preview says it short: the brand's short labels, the timing's too.
    expect(screen.getByText(/^« Bonjour Aquafix/)).toHaveTextContent(
      new RegExp(`^« Bonjour Aquafix 👋 · Ménage courant · Proche banlieue · 2 ch\\. · 40 à 70 m² · 2 sem\\. · 84\\s€ · Réf\\. ${ref} »$`, "u"),
    );
  });

  it("says an answer in its preview words, over the tile's short ones — the timing's full label stays in the message", async () => {
    render(
      estimate({
        questions: {
          bedrooms: { shortLabels: { t3: "2" }, previewLabels: { t3: "2 ch." } },
          surface: { previewLabels: { s70: "40–70 m²" } },
          frequency: { unknown: true, shortLabels: { biweekly: "2 sem" }, previewLabels: { biweekly: "toutes les 2 sem." } },
        },
      }),
    );
    const { ref } = await reach(TO_WHATSAPP.segment);
    answer("zone", "proche");
    answer("bedrooms", "t3");
    answer("surface", "s70");
    answer("frequency", "biweekly");
    expect(sent()).toEqual([
      "Bonjour Aquafix 👋",
      "Je souhaite un devis : Ménage courant · Proche banlieue · 2 ch. · 40–70 m²",
      expect.stringMatching(/^Estimation vue sur le site : 84\s€$/u),
      "Délai souhaité : Toutes les 2 semaines",
      `Réf. ${ref}`,
    ]);
    expect(screen.getByText(/^« Bonjour Aquafix/)).toHaveTextContent(
      new RegExp(`^« Bonjour Aquafix 👋 · Ménage courant · Proche banlieue · 2 ch\\. · 40–70 m² · toutes les 2 sem\\. · 84\\s€ · Réf\\. ${ref} »$`, "u"),
    );
    // The tile keeps its own short word; the preview's is the message's.
    const tile = screen.getByRole("radio", { name: /^2 chambres/ }).closest("label");
    expect(tile).toHaveTextContent(/^22 chambres/);
    expect(tile).not.toHaveTextContent("2 ch.");
  });

  it("writes no timing line for «Je ne sais pas»", async () => {
    render(estimate());
    const { ref } = await reach(TO_WHATSAPP.segment);
    answer("zone", "proche");
    answer("bedrooms", "t3");
    answer("surface", "s70");
    answer("frequency", "?");
    expect(sent()).toEqual(["Bonjour Aquafix 👋", "Je souhaite un devis : Ménage courant · Proche banlieue · 2 ch. · 40 à 70 m²", `Réf. ${ref}`]);
    expect(screen.getByText(/^« Bonjour Aquafix/)).not.toHaveTextContent(/2 sem\.|Je ne sais pas/);
  });

  it("writes no timing line until the timing question is answered", async () => {
    render(estimate());
    const { ref } = await reach(TO_WHATSAPP.segment);
    answer("zone", "proche");
    expect(sent()).toEqual(["Bonjour Aquafix 👋", "Je souhaite un devis : Ménage courant · Proche banlieue", `Réf. ${ref}`]);
  });
});
