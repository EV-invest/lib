/**
 * Every word `LeadCapture` prints. Plain strings, not the copy contract's
 * `Said<F>`: the form is a client island, and a function cannot cross from a
 * server page into it. A sentence that quotes something names it in braces —
 * `{need}`, `{day}`, `{time}` — and the component fills it in.
 *
 * The kit ships French and English (`LEAD_CAPTURE_TEXT`) so every brand asks
 * in the same words and an experiment's arms differ only in what it tests; a
 * brand overrides a key by spreading: `{ ...LEAD_CAPTURE_TEXT.fr, submit: "…" }`.
 *
 * The flows' words (`LeadCaptureFlowText`) are optional here so a brand's own
 * text object written before them still type-checks; a key left out falls
 * back to the kit's, in the page's language (`flowTextOf`).
 */
export interface LeadCaptureText extends Partial<LeadCaptureFlowText> {
  title: string;
  lede: string;
  needLabel: string;
  /** Re-opens a need chosen for the visitor. */
  needChange: string;
  localityLabel: string;
  /** Names the row of communes a tap fills the locality from. */
  servedLabel: string;
  phoneLabel: string;
  /**
   * Under a number that does not read as one, once the visitor leaves the
   * field — a hint while typing; the submit is blocked by `phoneInvalid`.
   */
  phoneHint: string;
  /** Blocks the submit: a number the server would refuse. */
  phoneInvalid: string;
  /** Blocks the submit: a required field left empty — the browser's own words are its UI language, not the page's. */
  required: string;
  /** Blocks the submit: no need picked. */
  needRequired: string;
  /** Blocks the callback: the consent box unticked. */
  consentRequired: string;
  /** The server refused a field the form cannot word better (a brand's own). */
  fieldInvalid: string;
  /** The server refused the request without naming a field. */
  formInvalid: string;
  /** On the submit while the script posts the form. */
  sending: string;
  /** The post never reached the server: nothing was sent, the form is as typed. */
  networkError: string;
  /** No answer in time: it may have arrived — a retry cannot make a second lead. */
  timeoutError: string;
  /** Beside the two above: sends the same lead again. */
  retry: string;
  nameLabel: string;
  /**
   * Shown in the empty field. None by default: a placeholder is not a label —
   * the label stays (visually hidden under `labels="hidden"`) for a brand
   * whose design draws placeholders instead.
   */
  localityPlaceholder?: string | undefined;
  phonePlaceholder?: string | undefined;
  namePlaceholder?: string | undefined;
  /** After an optional field's label. */
  optional: string;
  submit: string;
  privacy: string;
  /** Heads the other ways to reach the business. */
  otherChannels: string;
  call: string;
  whatsapp: string;
  sms: string;
  callback: string;
  callbackLede: string;
  /** Posted with the callback and kept with the lead word for word: what was agreed to. */
  callbackConsent: string;
  callbackSubmit: string;
  /** The WhatsApp and SMS message, `{need}` the need's label. */
  message: string;
  /** The same when no need is known. */
  messageGeneric: string;
  /** When closed: the next opening, from the place's real hours only. */
  openingToday: string;
  openingTomorrow: string;
  /** `{day}` is the weekday in the page's language. */
  openingLater: string;
  /** The honeypot's label — read only by a bot filling every field. */
  honeypotLabel: string;
}

/** What the `estimate` and `fixed` flows, the photos ask and the booking print. */
export interface LeadCaptureFlowText {
  /** Heads the live price. */
  priceTitle: string;
  /** In place of the price until every input is answered. */
  pricePending: string;
  /** Under the price: what it includes and when it is paid. */
  priceNote: string;
  /** The breakdown's first line: the need's base. */
  priceBase: string;
  priceRounding: string;
  priceMinimum: string;
  /** The submit of a priced need. */
  bookSubmit: string;
  /** The in-card success of a priced lead; `{price}` the server's. */
  sentPrice: string;
  /** After a priced lead: the slot is set by a call (no booking provider yet). */
  slotCallback: string;
  /** A `quote` need that is priced from photos: the ask, and its WhatsApp link. */
  photosTitle: string;
  photosLede: string;
  photosCta: string;
  /** The WhatsApp message, `{need}` the need's label. */
  photosMessage: string;
}

const FR_FLOW: LeadCaptureFlowText = {
  priceTitle: "Votre prix",
  pricePending: "Répondez aux questions pour voir le prix.",
  priceNote: "Prix TTC pour ces réponses, payé après la prestation.",
  priceBase: "Prix de base",
  priceRounding: "Arrondi",
  priceMinimum: "Minimum de prestation",
  bookSubmit: "Réserver",
  sentPrice: "Demande enregistrée au prix de {price}.",
  slotCallback: "Nous vous rappelons pour fixer le créneau.",
  photosTitle: "Envoyez des photos",
  photosLede: "Pour ce besoin, quelques photos nous permettent de vous donner un prix juste.",
  photosCta: "Envoyer des photos sur WhatsApp",
  photosMessage: "Bonjour, voici des photos pour : {need}.",
};

const EN_FLOW: LeadCaptureFlowText = {
  priceTitle: "Your price",
  pricePending: "Answer the questions to see the price.",
  priceNote: "Price incl. VAT for these answers, paid after the job.",
  priceBase: "Base price",
  priceRounding: "Rounding",
  priceMinimum: "Minimum charge",
  bookSubmit: "Book",
  sentPrice: "Request saved at {price}.",
  slotCallback: "We will call you to set the slot.",
  photosTitle: "Send photos",
  photosLede: "For this job, a few photos let us give you a fair price.",
  photosCta: "Send photos on WhatsApp",
  photosMessage: "Hello, here are photos for: {need}.",
};

const FR: LeadCaptureText = {
  ...FR_FLOW,
  title: "Recevoir un prix",
  lede: "Réponse rapide, sans engagement.",
  needLabel: "Votre besoin",
  needChange: "Modifier",
  localityLabel: "Code postal",
  servedLabel: "Communes desservies",
  phoneLabel: "Téléphone",
  phoneHint: "Vérifiez le numéro : 06 12 34 56 78 ou +33 6 12 34 56 78.",
  phoneInvalid: "Ce numéro n’est pas valide. Exemple : 06 12 34 56 78 ou +33 6 12 34 56 78.",
  required: "Ce champ est obligatoire.",
  needRequired: "Choisissez votre besoin.",
  consentRequired: "Cochez la case pour que nous puissions vous rappeler.",
  fieldInvalid: "Vérifiez ce champ.",
  formInvalid: "Votre demande n’a pas pu être envoyée. Vérifiez le formulaire.",
  sending: "Envoi…",
  networkError: "Pas de connexion : votre demande n’est pas partie. Vérifiez le réseau et réessayez.",
  timeoutError: "Le serveur ne répond pas. Réessayez : votre demande ne sera pas envoyée deux fois.",
  retry: "Réessayer",
  nameLabel: "Nom",
  optional: "facultatif",
  submit: "Recevoir le prix",
  privacy: "Votre numéro ne sert qu’à vous répondre.",
  otherChannels: "Ou contactez-nous",
  call: "Appeler",
  whatsapp: "WhatsApp",
  sms: "SMS",
  callback: "Rappelez-moi",
  callbackLede: "Laissez votre numéro, nous vous rappelons.",
  callbackConsent: "J’accepte d’être rappelé·e à ce numéro au sujet de ma demande.",
  callbackSubmit: "Être rappelé",
  message: "Bonjour, j’ai besoin de : {need}.",
  messageGeneric: "Bonjour, je souhaite un devis.",
  openingToday: "Nous vous rappelons dès {time}.",
  openingTomorrow: "Nous vous rappelons demain dès {time}.",
  openingLater: "Nous vous rappelons {day} dès {time}.",
  honeypotLabel: "Site web",
};

const EN: LeadCaptureText = {
  ...EN_FLOW,
  title: "Get a price",
  lede: "A quick answer, no commitment.",
  needLabel: "What you need",
  needChange: "Change",
  localityLabel: "Postcode",
  servedLabel: "Towns we serve",
  phoneLabel: "Phone",
  phoneHint: "Check the number: 06 12 34 56 78 or +33 6 12 34 56 78.",
  phoneInvalid: "This number is not valid. For example: 06 12 34 56 78 or +33 6 12 34 56 78.",
  required: "This field is required.",
  needRequired: "Choose what you need.",
  consentRequired: "Tick the box so we can call you back.",
  fieldInvalid: "Check this field.",
  formInvalid: "Your request could not be sent. Check the form.",
  sending: "Sending…",
  networkError: "No connection: your request was not sent. Check the network and try again.",
  timeoutError: "The server is not answering. Try again: your request will not be sent twice.",
  retry: "Try again",
  nameLabel: "Name",
  optional: "optional",
  submit: "Get the price",
  privacy: "Your number is used only to answer you.",
  otherChannels: "Or reach us",
  call: "Call",
  whatsapp: "WhatsApp",
  sms: "Text",
  callback: "Call me back",
  callbackLede: "Leave your number and we will call you back.",
  callbackConsent: "I agree to be called back on this number about my request.",
  callbackSubmit: "Call me back",
  message: "Hello, I need: {need}.",
  messageGeneric: "Hello, I would like a quote.",
  openingToday: "We call you back from {time}.",
  openingTomorrow: "We call you back tomorrow from {time}.",
  openingLater: "We call you back on {day} from {time}.",
  honeypotLabel: "Website",
};

export const LEAD_CAPTURE_TEXT: Readonly<Record<"fr" | "en", LeadCaptureText>> = { fr: FR, en: EN };

/** The flows' words for a page: the brand's, else the kit's in its language (English for `en*`, French otherwise). */
export function flowTextOf(text: LeadCaptureText, locale: string): LeadCaptureFlowText {
  const kit = locale.startsWith("en") ? EN_FLOW : FR_FLOW;
  const out: LeadCaptureFlowText = { ...kit };
  for (const key of Object.keys(kit) as (keyof LeadCaptureFlowText)[]) {
    const own = text[key];
    if (own !== undefined) out[key] = own;
  }
  return out;
}
