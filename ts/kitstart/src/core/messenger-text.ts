import type { MessengerMessageText } from "./messenger-message";

/**
 * What a `messenger` variant of `LeadCapture` prints — and the prefilled
 * message's lines. Optional in `LeadCaptureText`, as the flows' words are: a
 * brand's text from before the variants still type-checks, and a key left
 * out falls back to the kit's in the page's language (`messengerTextOf`).
 *
 * Apart from the flows' words on purpose: only a variant's own chunk reads
 * them, so the control's page never downloads them.
 */
export interface LeadCaptureMessengerText extends MessengerMessageText {
  /** The WhatsApp button. */
  messengerWhatsappCta: string;
  /** `saga`: the WhatsApp step's button. */
  messengerOpenWhatsapp: string;
  /** The Telegram button. */
  messengerTelegramCta: string;
  /** Under the submit when the place has a bot: the way to it. */
  messengerViaTelegram: string;
  /** A channel's name in a picker, a tile, a segment — and its line under it. */
  messengerOptionWhatsapp: string;
  messengerOptionWhatsappNote: string;
  messengerOptionCall: string;
  messengerOptionCallNote: string;
  messengerOptionTelegram: string;
  messengerOptionTelegramNote: string;
  /** The badge on the recommended channel. */
  messengerRecommended: string;
  /** Names a channel picker for assistive technology. */
  messengerChannelLabel: string;
  /** The way to the phone, beside the messengers. */
  messengerCallback: string;
  /** `swap`, `split`: the square back to WhatsApp, for assistive technology. */
  messengerBackToWhatsapp: string;
  /** The phone field's placeholder when the phone is optional. */
  messengerPhoneOptional: string;
  /** `select`: under the field, by channel. */
  messengerWhatsappHint: string;
  messengerTelegramHint: string;
  /** The message's preview in the slot: its heading, and an optional line after the message. */
  messengerPreviewTitle: string;
  /** The estimate in the preview, `{price}` the amount («env. {price}»). */
  messengerPreviewPrice: string;
  messengerPreviewNote: string;
  /** Telegram's card in the slot. */
  messengerBotTitle: string;
  messengerBotLede: string;
  /** `tiles`: over the tiles. */
  messengerTilesLabel: string;
  /** `thanks`: the success's ask, and its WhatsApp button. */
  messengerThanksTitle: string;
  messengerThanksCta: string;
  /** `saga`: the channel screen. */
  messengerSagaTitle: string;
  messengerSagaLede: string;
  messengerSagaFoot: string;
  /** `saga`, `sheet`: back to the channels. */
  messengerChange: string;
  /** `saga`, `sheet`: the second screen's heading and lede, by channel. */
  messengerWhatsappTitle: string;
  messengerWhatsappLede: string;
  messengerTelegramTitle: string;
  messengerTelegramLede: string;
  messengerCallTitle: string;
  messengerCallLede: string;
  /** `urgency`: the question, its two answers, and what each leads to. */
  messengerUrgencyLabel: string;
  messengerUrgencyYes: string;
  messengerUrgencyNo: string;
  /** The message's timing line for an urgent need, and for one that can wait. */
  messengerUrgencyToday: string;
  messengerUrgencyLater: string;
  messengerUrgentSubmit: string;
  messengerNotUrgentTitle: string;
  /** `{ref}` the reference. */
  messengerNotUrgentLede: string;
  /** `sheet`: the card's one button and the drawer's heading. */
  messengerSheetCta: string;
  messengerSheetTitle: string;
  /** `chip`: the chip, by channel. */
  messengerChipWhatsapp: string;
  messengerChipCall: string;
  messengerChipTelegram: string;
  /** `split`: the WhatsApp half of the row. */
  messengerSplitCta: string;
  /** In an app's own browser (Instagram, TikTok…): WhatsApp may not open from it. */
  messengerInappHint: string;
  messengerCopy: string;
  messengerCopied: string;
  /** Back from the messenger: `{channel}` its name, `{ref}` the reference. */
  messengerReturnTitle: string;
  messengerReturnBody: string;
  messengerReopen: string;
  messengerReturnFailed: string;
  messengerReturnDone: string;
  /** On a computer: the QR code that opens WhatsApp on the phone. */
  messengerQrTitle: string;
  messengerQrLede: string;
  messengerQrWeb: string;
  messengerQrAlt: string;
}

const FR: LeadCaptureMessengerText = {
  messageHello: "Bonjour {brand} 👋",
  messageNeed: "Je souhaite un devis : {need}",
  messagePostcode: "Code postal : {postcode}",
  messagePrice: "Estimation vue sur le site : {price}",
  messageTiming: "Délai souhaité : {timing}",
  messageRef: "Réf. {ref}",
  messengerWhatsappCta: "Recevoir mon devis sur WhatsApp",
  messengerOpenWhatsapp: "Ouvrir WhatsApp",
  messengerTelegramCta: "Ouvrir Telegram",
  messengerViaTelegram: "ou via Telegram",
  messengerOptionWhatsapp: "WhatsApp",
  messengerOptionWhatsappNote: "Recommandé · demande déjà rédigée",
  messengerOptionCall: "Appel",
  messengerOptionCallNote: "On vous rappelle rapidement",
  messengerOptionTelegram: "Telegram",
  messengerOptionTelegramNote: "Via notre bot Telegram",
  messengerRecommended: "Recommandé",
  messengerChannelLabel: "Canal de réponse",
  messengerCallback: "Être rappelé",
  messengerBackToWhatsapp: "Revenir à WhatsApp",
  messengerPhoneOptional: "Téléphone (facultatif)",
  messengerWhatsappHint: "WhatsApp s’ouvre, demande déjà rédigée. Numéro facultatif.",
  messengerTelegramHint: "Telegram s’ouvre : notre bot vous répond.",
  messengerPreviewTitle: "Votre message est prêt",
  messengerPreviewPrice: "{price}",
  messengerPreviewNote: "",
  messengerBotTitle: "Notre bot vous envoie le devis",
  messengerBotLede: "Telegram s’ouvre : appuyez sur « Démarrer », le devis arrive dans le chat.",
  messengerTilesLabel: "Recevoir mon devis par",
  messengerThanksTitle: "Plus rapide : envoyez une photo",
  messengerThanksCta: "Envoyer la photo sur WhatsApp",
  messengerSagaTitle: "Comment voulez-vous nous joindre ?",
  messengerSagaLede: "Réponse rapide, sans engagement.",
  messengerSagaFoot: "Réponse rapide · sans engagement",
  messengerChange: "Changer de canal",
  messengerWhatsappTitle: "Sur WhatsApp",
  messengerWhatsappLede: "Puis WhatsApp s’ouvre, message prêt.",
  messengerTelegramTitle: "Sur Telegram",
  messengerTelegramLede: "Puis Telegram s’ouvre : notre bot vous répond.",
  messengerCallTitle: "On vous rappelle",
  messengerCallLede: "Laissez votre numéro.",
  messengerUrgencyLabel: "C’est urgent ?",
  messengerUrgencyYes: "Oui, aujourd’hui",
  messengerUrgencyNo: "Non, je compare",
  messengerUrgencyToday: "aujourd’hui",
  messengerUrgencyLater: "pas pressé",
  messengerUrgentSubmit: "Rappelez-moi tout de suite",
  messengerNotUrgentTitle: "Pas pressé ? Message prêt",
  messengerNotUrgentLede: "Un message sur WhatsApp suffit. Réf. {ref}.",
  messengerSheetCta: "Recevoir mon devis",
  messengerSheetTitle: "Où recevoir votre devis ?",
  messengerChipWhatsapp: "Réponse sur WhatsApp",
  messengerChipCall: "Réponse par appel",
  messengerChipTelegram: "Réponse sur Telegram",
  messengerSplitCta: "Devis sur WhatsApp",
  messengerInappHint: "WhatsApp ne s’ouvre pas ? Menu ⋯ → « Ouvrir dans le navigateur ».",
  messengerCopy: "Copier le message",
  messengerCopied: "Message copié",
  messengerReturnTitle: "Message envoyé ?",
  messengerReturnBody: "Si oui, on vous répond sur {channel} rapidement, référence {ref}.",
  messengerReopen: "Rouvrir {channel}",
  messengerReturnFailed: "Je n’ai pas pu envoyer → être rappelé",
  messengerReturnDone: "C’est envoyé",
  messengerQrTitle: "Scannez avec votre téléphone",
  messengerQrLede: "WhatsApp s’ouvre avec votre demande déjà rédigée.",
  messengerQrWeb: "ou ouvrir WhatsApp Web →",
  messengerQrAlt: "QR code qui ouvre WhatsApp avec votre demande",
};

const EN: LeadCaptureMessengerText = {
  messageHello: "Hello {brand} 👋",
  messageNeed: "I would like a quote: {need}",
  messagePostcode: "Postcode: {postcode}",
  messagePrice: "Estimate seen on the site: {price}",
  messageTiming: "When: {timing}",
  messageRef: "Ref. {ref}",
  messengerWhatsappCta: "Get my quote on WhatsApp",
  messengerOpenWhatsapp: "Open WhatsApp",
  messengerTelegramCta: "Open Telegram",
  messengerViaTelegram: "or via Telegram",
  messengerOptionWhatsapp: "WhatsApp",
  messengerOptionWhatsappNote: "Recommended · request already written",
  messengerOptionCall: "Call",
  messengerOptionCallNote: "We call you back shortly",
  messengerOptionTelegram: "Telegram",
  messengerOptionTelegramNote: "Through our Telegram bot",
  messengerRecommended: "Recommended",
  messengerChannelLabel: "Where to answer you",
  messengerCallback: "Call me back",
  messengerBackToWhatsapp: "Back to WhatsApp",
  messengerPhoneOptional: "Phone (optional)",
  messengerWhatsappHint: "WhatsApp opens with your request written. Phone optional.",
  messengerTelegramHint: "Telegram opens: our bot answers you.",
  messengerPreviewTitle: "Your message is ready",
  messengerPreviewPrice: "{price}",
  messengerPreviewNote: "",
  messengerBotTitle: "Our bot sends you the quote",
  messengerBotLede: "Telegram opens: tap “Start” and the quote arrives in the chat.",
  messengerTilesLabel: "Get my quote by",
  messengerThanksTitle: "Faster: send a photo",
  messengerThanksCta: "Send the photo on WhatsApp",
  messengerSagaTitle: "How would you like to reach us?",
  messengerSagaLede: "A quick answer, no commitment.",
  messengerSagaFoot: "Quick answer · no commitment",
  messengerChange: "Change channel",
  messengerWhatsappTitle: "On WhatsApp",
  messengerWhatsappLede: "Then WhatsApp opens with the message ready.",
  messengerTelegramTitle: "On Telegram",
  messengerTelegramLede: "Then Telegram opens: our bot answers you.",
  messengerCallTitle: "We call you back",
  messengerCallLede: "Leave your number.",
  messengerUrgencyLabel: "Is it urgent?",
  messengerUrgencyYes: "Yes, today",
  messengerUrgencyNo: "No, comparing",
  messengerUrgencyToday: "today",
  messengerUrgencyLater: "no rush",
  messengerUrgentSubmit: "Call me right away",
  messengerNotUrgentTitle: "No rush? Message ready",
  messengerNotUrgentLede: "A WhatsApp message is enough. Ref. {ref}.",
  messengerSheetCta: "Get my quote",
  messengerSheetTitle: "Where should we send your quote?",
  messengerChipWhatsapp: "Answer on WhatsApp",
  messengerChipCall: "Answer by phone",
  messengerChipTelegram: "Answer on Telegram",
  messengerSplitCta: "Quote on WhatsApp",
  messengerInappHint: "WhatsApp does not open? Menu ⋯ → “Open in browser”.",
  messengerCopy: "Copy the message",
  messengerCopied: "Message copied",
  messengerReturnTitle: "Message sent?",
  messengerReturnBody: "If so, we answer you on {channel} shortly, reference {ref}.",
  messengerReopen: "Open {channel} again",
  messengerReturnFailed: "I could not send it → call me back",
  messengerReturnDone: "It is sent",
  messengerQrTitle: "Scan with your phone",
  messengerQrLede: "WhatsApp opens with your request already written.",
  messengerQrWeb: "or open WhatsApp Web →",
  messengerQrAlt: "QR code that opens WhatsApp with your request",
};

export const LEAD_CAPTURE_MESSENGER_TEXT: Readonly<Record<"fr" | "en", LeadCaptureMessengerText>> = { fr: FR, en: EN };

/** The variants' words for a page: the brand's, else the kit's in its language (English for `en*`, French otherwise). */
export function messengerTextOf(text: Partial<LeadCaptureMessengerText>, locale: string): LeadCaptureMessengerText {
  const kit = locale.startsWith("en") ? EN : FR;
  const out: LeadCaptureMessengerText = { ...kit };
  for (const key of Object.keys(kit) as (keyof LeadCaptureMessengerText)[]) {
    const own = text[key];
    if (own !== undefined) out[key] = own;
  }
  return out;
}
