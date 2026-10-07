import type { AnalyticsSink } from "@evinvest/analytics";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEAD_CAPTURE_MESSENGER_TEXT, LEAD_CAPTURE_TEXT, MESSAGE_REF, type MessengerFacts, type MessengerKind, type MessengerVariant } from "../src/index";
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
    expect(new URL(href).searchParams.get("text")?.split("\n")).toEqual(["Bonjour Aquafix 👋", "Je souhaite un devis : Fuite d’eau", `Réf. ${ref}`]);
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

  it("is drawn again under a new reference once a lead is posted", async () => {
    render(card("segment"));
    const { link, ref } = await reach(TO_WHATSAPP.segment);
    fireEvent.click(link);
    await waitFor(() => expect(currentRef()).not.toBe(ref));
    expect(currentRef()).toMatch(MESSAGE_REF);
    const again = new URL(screen.getByRole("link", { name: M.messengerWhatsappCta }).getAttribute("href") ?? "");
    expect(again.searchParams.get("text")).toContain(`Réf. ${currentRef()}`);
  });
});
