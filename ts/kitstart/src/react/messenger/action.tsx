"use client";

import { whatsappHref } from "@evinvest/marketing";
import { Badge, Button, cn, Select, SelectContent, SelectItem, SelectTrigger } from "@evinvest/uikit";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { fillText } from "../../core/lead-capture-format";
import { telegramHref, type MessengerMode } from "../../core/messenger";
import { messengerMessage } from "../../core/messenger-message";
import { messengerTextOf, type LeadCaptureMessengerText } from "../../core/messenger-text";
import { phoneProblem } from "../../core/phone";
import { partWithLeading } from "../parts";
import { useAnalyticsId } from "../analytics-context";
import { postInBackground } from "../use-lead-submit";
import type { MessengerKit } from "./types";

export type Messenger = Exclude<MessengerMode, "call">;

/** The variant's words, the brand's over the kit's. */
export const wordsOf = (kit: MessengerKit): LeadCaptureMessengerText => messengerTextOf(kit.text, kit.locale);

const formOf = (kit: MessengerKit): HTMLFormElement | null => {
  if (typeof document === "undefined") return null;
  const el = document.getElementById(`${kit.id}-form`);
  return el instanceof HTMLFormElement ? el : null;
};

/** A posted field's value as it stands — an element of the form wherever it is drawn. */
function valueOf(form: HTMLFormElement | null, name: string): string {
  const el = form?.elements.namedItem(name);
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement ? el.value.trim() : "";
}

/**
 * What the message says: the need the card knows, the postcode as the
 * visitor types it — and the estimate, the timing and the reference. The
 * preview follows the typing; `compose` reads the form again at the tap, so
 * the link carries what is on screen even after a value set by script.
 */
export interface Message {
  message: string;
  preview: string;
  compose: () => string;
}

export function useMessage(kit: MessengerKit, own?: string | null): Message {
  // A variant's own timing (`urgency`), else the estimate's answer the brand named.
  const timing = own === undefined ? kit.timing : own === null ? null : { label: own, short: own };
  const [postcode, setPostcode] = useState("");
  useEffect(() => {
    const form = formOf(kit);
    if (!form) return;
    const read = () => setPostcode(valueOf(form, kit.wire.locality));
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
    };
  }, [kit.id, kit.wire.locality]);
  const words = wordsOf(kit);
  // The need with the estimate's answers: «Ménage standard · 2 ch. · 40–70 m²».
  const need = kit.needLabel ? [kit.needLabel, ...kit.answers].join(" · ") : null;
  const compose = (code: string) =>
    messengerMessage({ brand: kit.brand, need, postcode: code, price: kit.priceText, timing: timing?.label ?? null, ref: kit.messageRef }, words);
  const ref = kit.messageRef ? fillText(words.messageRef, { ref: kit.messageRef }) : null;
  const price = kit.priceText ? fillText(words.messengerPreviewPrice, { price: kit.priceText }) : null;
  const preview = [fillText(words.messageHello, { brand: kit.brand }), need, timing?.short, price, postcode, ref].filter(Boolean).join(" · ");
  return { message: compose(postcode), preview, compose: () => compose(valueOf(formOf(kit), kit.wire.locality)) };
}

/** Where a messenger CTA leads: wa.me with the message, or the bot with the reference. */
export function hrefOf(kit: MessengerKit, channel: Messenger, message: string): string | null {
  if (channel === "whatsapp") return kit.facts.whatsapp ? whatsappHref(kit.facts.whatsapp, message) : null;
  return kit.facts.telegram ? telegramHref(kit.facts.telegram, kit.messageRef ?? undefined) : null;
}

/** A computer: no touch to hand a link to an app, and a screen wide enough to read a QR code off. */
const isDesktop = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(hover: hover) and (pointer: fine)").matches && window.innerWidth >= 768;

/** The browsers of apps that hold a link to themselves: WhatsApp may not open from them. */
const IN_APP = /Instagram|FBAN|FBAV|TikTok|musical_ly|BytedanceWebview|\bLine\/|Snapchat/i;

const noop = () => () => undefined;

/** Whether the page runs in such a browser — after hydration only: the server cannot know. */
function useInApp(): boolean {
  return useSyncExternalStore(
    noop,
    () => IN_APP.test(navigator.userAgent),
    () => false,
  );
}

interface Left {
  channel: Messenger;
  ref: string | null;
  href: string;
}

/**
 * A messenger link's attributes. Not `ready` (before the script, before the
 * reference): no `href` — nothing to follow — and `aria-disabled`.
 */
export interface LinkAttrs {
  href?: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  target?: string;
  rel?: string;
  "aria-disabled"?: true;
}

export interface MessengerAction {
  /** A messenger CTA's link: the real `href` (the OS opens the app from the tap) and what the tap does first. */
  link: (channel: Messenger) => LinkAttrs | null;
  /** On a computer, WhatsApp's QR code, drawn in place of the slot; `null` otherwise. */
  panel: ReactNode;
  /** Back from the messenger: drawn over the card's form. */
  overlay: ReactNode;
}

/**
 * The tap on a messenger CTA, shared by every variant: a number typed must be
 * one (the browser says so, nothing leaves); the lead is posted in the
 * background; on a phone the link opens the app, on a computer WhatsApp is a
 * QR code in place and Telegram a new tab. Back on the page, the card asks
 * whether the message went, with the way to a call when it did not.
 */
export function useMessengerAction(
  kit: MessengerKit,
  message: Message,
  onCallback: () => void,
  /**
   * `followUp`: the lead is already sent (`thanks`) — a tap posts nothing,
   * keeps the reference and asks nothing on the way back.
   */
  options: { followUp?: boolean } = {},
): MessengerAction {
  const followUp = options.followUp === true;
  const analyticsId = useAnalyticsId();
  const words = wordsOf(kit);
  const [qr, setQr] = useState<string | null>(null);
  const [back, setBack] = useState<Left | null>(null);
  const left = useRef<Left | null>(null);

  useEffect(() => {
    let hidden = false;
    const change = () => {
      if (document.visibilityState === "hidden") hidden = true;
      else if (hidden && left.current) {
        hidden = false;
        setBack(left.current);
        left.current = null;
      }
    };
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);

  const link: MessengerAction["link"] = channel => {
    // The render's message — the server has no form to read; the tap reads it again.
    const href = hrefOf(kit, channel, message.message);
    if (!href) return null;
    if (!kit.ready) return { "aria-disabled": true, onClick: event => event.preventDefault() };
    const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
      const form = formOf(kit);
      const phone = form?.elements.namedItem(kit.wire.mobile);
      if (phone instanceof HTMLInputElement && phone.value.trim() !== "" && phoneProblem(phone.value) !== null) {
        event.preventDefault();
        phone.reportValidity();
        return;
      }
      const ref = kit.messageRef;
      // What is on screen now; the link follows it before the browser does.
      const fresh = hrefOf(kit, channel, message.compose()) ?? href;
      event.currentTarget.href = fresh;
      if (form && !followUp) void postInBackground(form, { channel, ...(ref ? { message_ref: ref } : {}) }, analyticsId);
      const desktop = isDesktop();
      kit.events.messengerOpen({ channel, device: desktop ? "desktop" : "mobile", inapp: IN_APP.test(navigator.userAgent), ref });
      if (desktop && channel === "whatsapp") {
        event.preventDefault();
        setQr(fresh);
        kit.events.qrShown();
      } else if (!followUp) {
        left.current = { channel, ref, href: fresh };
      }
      // Never renewed here: React redraws the link before the browser follows
      // it, and the visitor would leave with a reference the lead does not
      // carry. A second tap on the same lead is the same reference and the
      // same submission id — one lead.
    };
    return channel === "telegram" ? { href, onClick, target: "_blank", rel: "noopener" } : { href, onClick };
  };

  const callback = () => {
    setQr(null);
    onCallback();
  };
  const panel = qr && <QrPanel href={qr} words={words} onCallback={followUp ? null : callback} kit={kit} />;
  const answer = (said: "sent" | "failed") => {
    if (back) kit.events.messengerReturn({ channel: back.channel, answer: said, ref: back.ref });
    setBack(null);
    // Back from the chat and answered: the next lead is another, with a reference of its own.
    if (!followUp) kit.renewRef();
    if (said === "failed") onCallback();
  };
  const overlay = back && <ReturnScreen left={back} words={words} onAnswer={answer} kit={kit} />;
  return { link, panel, overlay };
}

/** To the phone: the variant's call state, its field focused once it is drawn. */
export function toCall(kit: MessengerKit): void {
  kit.setMode("call");
  requestAnimationFrame(() => formOf(kit)?.querySelector<HTMLInputElement>('[data-lead-field="phone"]')?.focus());
}

/** A computer, as `isDesktop` says it — after hydration only. */
export function useDesktop(): boolean {
  return useSyncExternalStore(noop, isDesktop, () => false);
}

/** The slot by the channel — the message, the bot, or the phone — and the channel's button under it. */
export function ModeBody(props: { kit: MessengerKit; message: Message; action: MessengerAction; labels?: Partial<Record<MessengerMode, string>> }) {
  const { kit, message, action, labels } = props;
  const words = wordsOf(kit);
  const mode = kit.mode ?? "whatsapp";
  return (
    <>
      <Slot kit={kit}>{mode === "call" ? kit.phone() : mode === "telegram" ? <BotCard kit={kit} /> : (action.panel ?? <Preview kit={kit} preview={message.preview} />)}</Slot>
      {mode === "call" ? (
        kit.submit(labels?.call)
      ) : (
        <MessengerCta kit={kit} action={action} channel={mode} label={labels?.[mode] ?? (mode === "whatsapp" ? words.messengerWhatsappCta : words.messengerTelegramCta)} />
      )}
      {mode === "whatsapp" && <InappHint kit={kit} message={message.message} />}
    </>
  );
}

const iconOf = (kit: MessengerKit, channel: MessengerMode): ReactNode => (channel === "call" ? (kit.icons?.phone ?? kit.icons?.callback) : kit.icons?.[channel]);

/** Whether the brand drew an icon for a channel: a square without one says its name instead. */
export const hasIcon = (kit: MessengerKit, channel: MessengerMode): boolean => iconOf(kit, channel) !== undefined && iconOf(kit, channel) !== null;

/** A channel as a square beside the row's button: its icon, or — the brand drew none — its name; `label` says what it does. */
export function SquareButton(props: { kit: MessengerKit; channel: MessengerMode; label: string; onClick: () => void }) {
  const { kit, channel } = props;
  const icon = hasIcon(kit, channel);
  return (
    <Button type="button" variant="outline" size="touch" icon={icon} aria-label={props.label} className={cn("shrink-0", kit.classNames?.messengerSquare)} onClick={props.onClick}>
      {icon ? <Glyph kit={kit} channel={channel} /> : labelOf(wordsOf(kit), channel)}
    </Button>
  );
}

/** The brand's icon for a channel, hidden from assistive technology: the label names it. */
export function Glyph({ kit, channel }: { kit: MessengerKit; channel: MessengerMode }) {
  const icon = iconOf(kit, channel);
  if (icon === undefined || icon === null) return null;
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center [&_svg]:size-5">
      {icon}
    </span>
  );
}

/** A messenger CTA: a real link dressed as the card's button, its in-app hint under it. */
/** A whole-pixel line under a brand's own type size, as the channel buttons keep one. */
const CTA_LEADING = "leading-6";

/** The part a messenger button wears: the main one, a secondary one, or a square. */
const partOf = (kit: MessengerKit, kind: "cta" | "secondary" | "square"): string | undefined =>
  kind === "cta" ? kit.classNames?.messengerCta : kind === "secondary" ? kit.classNames?.messengerSecondary : kit.classNames?.messengerSquare;

export function MessengerCta(props: { kit: MessengerKit; action: MessengerAction; channel: Messenger; label: string; variant?: "primary" | "outline"; className?: string | undefined; square?: boolean }) {
  const { kit, action, channel } = props;
  const link = action.link(channel);
  if (!link) return null;
  const { onClick, ...attrs } = link;
  const square = props.square === true && hasIcon(kit, channel);
  return (
    <Button
      asChild
      variant={props.variant ?? "primary"}
      size="touch"
      icon={square}
      className={partWithLeading(
        cn(props.square ? "shrink-0" : "w-full", props.className),
        CTA_LEADING,
        partOf(kit, props.square ? "square" : props.variant === "outline" ? "secondary" : "cta"),
      )}
    >
      <a
        {...attrs}
        onClick={onClick}
        aria-label={square ? props.label : undefined}
        data-experiment={kit.experiment?.name}
        data-variant={kit.experiment?.variant}
        data-intent={channel === "telegram" ? "telegram" : undefined}
      >
        <Glyph kit={kit} channel={channel} />
        {!square && props.label}
      </a>
    </Button>
  );
}

/** In an app's own browser: WhatsApp may not open — how to leave it, and the message to paste. */
export function InappHint({ kit, message }: { kit: MessengerKit; message: string }) {
  const inApp = useInApp();
  const [copied, setCopied] = useState(false);
  if (!inApp || !kit.facts.whatsapp) return null;
  const words = wordsOf(kit);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft", kit.classNames?.messengerHint)}>
      <span>{words.messengerInappHint}</span>
      <Button
        type="button"
        variant="link"
        size="touch"
        className="px-1"
        onClick={() => void navigator.clipboard?.writeText(message).then(() => setCopied(true), () => undefined)}
      >
        {copied ? words.messengerCopied : words.messengerCopy}
      </Button>
    </div>
  );
}

/** The fixed box a variant swaps its states in; the brand gives it its height (`messengerSlot`). */
export function Slot({ kit, children }: { kit: MessengerKit; children: ReactNode }) {
  return <div className={cn("flex flex-col justify-center", kit.classNames?.messengerSlot)}>{children}</div>;
}

/** The message, ready: what goes into the chat, so the visitor knows there is nothing to write. */
export function Preview({ kit, preview, title, lede }: { kit: MessengerKit; preview: string; title?: string; lede?: string }) {
  const words = wordsOf(kit);
  return (
    <div className={cn("flex items-start gap-3 rounded-[var(--control-radius)] bg-muted p-3", kit.classNames?.messengerPreview)}>
      <Glyph kit={kit} channel="whatsapp" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-ink">{title ?? words.messengerPreviewTitle}</p>
        <p className="line-clamp-2 text-sm text-ink-soft">{lede ?? `« ${preview} »${words.messengerPreviewNote ? ` ${words.messengerPreviewNote}` : ""}`}</p>
      </div>
    </div>
  );
}

/** What the bot does, in the slot. */
export function BotCard({ kit }: { kit: MessengerKit }) {
  const words = wordsOf(kit);
  return (
    <div className={cn("flex items-start gap-3 rounded-[var(--control-radius)] bg-muted p-3", kit.classNames?.messengerPreview)}>
      <Glyph kit={kit} channel="telegram" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-ink">{words.messengerBotTitle}</p>
        <p className="line-clamp-2 text-sm text-ink-soft">{words.messengerBotLede}</p>
      </div>
    </div>
  );
}

/** «ou via Telegram»: the bot, as a link under the submit. */
export function TelegramLink({ kit, action }: { kit: MessengerKit; action: MessengerAction }) {
  const link = action.link("telegram");
  if (!link) return null;
  const { onClick, ...attrs } = link;
  return (
    <Button asChild variant="link" size="touch" className={cn("self-center", kit.classNames?.messengerSecondary)}>
      <a {...attrs} onClick={onClick} data-intent="telegram" data-experiment={kit.experiment?.name} data-variant={kit.experiment?.variant}>
        <Glyph kit={kit} channel="telegram" />
        {wordsOf(kit).messengerViaTelegram}
      </a>
    </Button>
  );
}

/** The channels a variant offers, in the Figma order; Telegram only with a bot. */
export function modesOf(kit: MessengerKit, order: readonly MessengerMode[] = ["whatsapp", "call", "telegram"]): MessengerMode[] {
  return order.filter(m => (m === "whatsapp" ? kit.facts.whatsapp !== null : m === "telegram" ? kit.facts.telegram !== null : true));
}

export const labelOf = (words: LeadCaptureMessengerText, mode: MessengerMode): string =>
  mode === "whatsapp" ? words.messengerOptionWhatsapp : mode === "telegram" ? words.messengerOptionTelegram : words.messengerOptionCall;

export const noteOf = (words: LeadCaptureMessengerText, mode: MessengerMode): string =>
  mode === "whatsapp" ? words.messengerOptionWhatsappNote : mode === "telegram" ? words.messengerOptionTelegramNote : words.messengerOptionCallNote;

/**
 * The kit's `Select` as a channel picker: an overlay, so the form under it
 * does not move. The trigger draws its own label — `SelectValue` would print
 * the raw value.
 */
export function ChannelPicker(props: { kit: MessengerKit; trigger: ReactNode; triggerClassName?: string | undefined }) {
  const { kit } = props;
  const words = wordsOf(kit);
  // Its own id: inside the phone's `Field` the trigger would claim the field's,
  // and the label «Téléphone» would name the picker instead of the number.
  const id = useId();
  return (
    <Select value={kit.mode ?? "whatsapp"} onValueChange={v => kit.setMode(modesOf(kit).find(m => m === v) ?? "call")}>
      <SelectTrigger id={id} aria-label={words.messengerChannelLabel} className={cn("border-0 shadow-none", props.triggerClassName, kit.classNames?.messengerTrigger)}>
        {props.trigger}
      </SelectTrigger>
      <SelectContent>
        {modesOf(kit).map(mode => (
          <SelectItem key={mode} value={mode} textValue={labelOf(words, mode)} className={kit.classNames?.messengerOption}>
            <span className="flex items-center gap-3">
              <Glyph kit={kit} channel={mode} />
              <span className="flex flex-col">
                <span className="font-medium text-ink">{labelOf(words, mode)}</span>
                <span className="text-xs text-ink-soft">{noteOf(words, mode)}</span>
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A channel as a card to tap (`saga`, `sheet`): its name, its line, the recommended badge on WhatsApp. */
export function OptionCard(props: {
  kit: MessengerKit;
  mode: MessengerMode;
  /** A step in the card; or, for a messenger, `link` — a real link, the app opened from the tap. */
  onPick?: () => void;
  link?: ReturnType<MessengerAction["link"]>;
  recommended?: boolean;
}) {
  const { kit, mode, link } = props;
  const words = wordsOf(kit);
  const className = cn(
    "flex w-full items-center gap-3 rounded-[var(--control-radius)] border border-border p-3 text-left outline-none hover:bg-hover focus-visible:ring-[3px] focus-visible:ring-ring/50",
    props.recommended && "border-primary",
    kit.classNames?.messengerOption,
  );
  const body = (
    <>
      <Glyph kit={kit} channel={mode} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 font-medium text-ink">
          {labelOf(words, mode)}
          {props.recommended && <Badge>{words.messengerRecommended}</Badge>}
        </span>
        <span className="text-sm text-ink-soft">{noteOf(words, mode)}</span>
      </span>
      <span aria-hidden="true" className="text-ink-soft">
        ›
      </span>
    </>
  );
  if (link) {
    const { onClick, ...attrs } = link;
    return (
      <a {...attrs} onClick={onClick} className={className} data-messenger-option="" data-intent={mode === "telegram" ? "telegram" : undefined} data-experiment={kit.experiment?.name} data-variant={kit.experiment?.variant}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" onClick={props.onPick} className={className} data-messenger-option="">
      {body}
    </button>
  );
}

/** A QR code drawn from `qrcode-generator`, loaded on the first desktop tap only. */
function QrCode({ value, label, className }: { value: string; label: string; className?: string | undefined }) {
  const [code, setCode] = useState<{ size: number; path: string } | null>(null);
  useEffect(() => {
    let live = true;
    void import("qrcode-generator").then(({ default: qrcode }) => {
      const qr = qrcode(0, "L");
      qr.addData(value);
      qr.make();
      const size = qr.getModuleCount();
      let path = "";
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
      if (live) setCode({ size, path });
    });
    return () => {
      live = false;
    };
  }, [value]);
  return (
    <svg role="img" aria-label={label} viewBox={code ? `-2 -2 ${code.size + 4} ${code.size + 4}` : "0 0 1 1"} shapeRendering="crispEdges" className={cn("size-28 shrink-0 bg-card text-ink", className)}>
      {code && <path d={code.path} fill="currentColor" />}
    </svg>
  );
}

export function QrPanel(props: { href: string; words: LeadCaptureMessengerText; onCallback: (() => void) | null; kit: MessengerKit }) {
  const { href, words, kit } = props;
  return (
    <div className={cn("flex items-center gap-4 rounded-[var(--control-radius)] border border-border p-3", kit.classNames?.messengerQr)}>
      <QrCode value={href} label={words.messengerQrAlt} />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium text-ink">{words.messengerQrTitle}</p>
        <p className="text-sm text-ink-soft">{words.messengerQrLede}</p>
        <a href={href} target="_blank" rel="noopener" className="text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
          {words.messengerQrWeb}
        </a>
        {props.onCallback && (
          <Button type="button" variant="link" size="touch" className={cn("self-start px-0", kit.classNames?.messengerSecondary)} onClick={props.onCallback}>
            {words.messengerCallback}
          </Button>
        )}
      </div>
    </div>
  );
}

function ReturnScreen(props: { left: Left; words: LeadCaptureMessengerText; onAnswer: (said: "sent" | "failed") => void; kit: MessengerKit }) {
  const c = props.kit.classNames;
  const { left, words } = props;
  const title = useRef<HTMLParagraphElement>(null);
  // The card under it is still there: the question takes the focus, and is read out.
  useEffect(() => title.current?.focus(), []);
  const name = left.channel === "whatsapp" ? words.messengerOptionWhatsapp : words.messengerOptionTelegram;
  return (
    <div role="status" className={cn("absolute inset-0 z-10 flex flex-col justify-center gap-4 bg-card", c?.messengerReturn)}>
      <p ref={title} tabIndex={-1} className="font-display text-xl font-bold text-ink outline-none">
        {words.messengerReturnTitle}
      </p>
      <p className="text-ink-soft">{fillText(words.messengerReturnBody, { channel: name, ref: left.ref ?? "" })}</p>
      <Button asChild variant="outline" size="touch" className={partWithLeading("w-full", CTA_LEADING, c?.messengerSecondary)}>
        <a href={left.href} {...(left.channel === "telegram" ? { target: "_blank", rel: "noopener" } : {})}>
          {fillText(words.messengerReopen, { channel: name })}
        </a>
      </Button>
      <Button type="button" size="touch" className={partWithLeading("w-full", CTA_LEADING, c?.messengerCta)} onClick={() => props.onAnswer("failed")}>
        {words.messengerReturnFailed}
      </Button>
      <Button type="button" variant="link" size="touch" className="self-center" onClick={() => props.onAnswer("sent")}>
        {words.messengerReturnDone}
      </Button>
    </div>
  );
}
