/**
 * Every word `LeadCapture` prints. Plain strings, not the copy contract's
 * `Said<F>`: the form is a client island, and a function cannot cross from a
 * server page into it. A sentence that quotes something names it in braces —
 * `{need}`, `{day}`, `{time}` — and the component fills it in.
 *
 * The kit ships French and English (`LEAD_CAPTURE_TEXT`) so every brand asks
 * in the same words and an experiment's arms differ only in what it tests; a
 * brand overrides a key by spreading: `{ ...LEAD_CAPTURE_TEXT.fr, submit: "…" }`.
 */
export interface LeadCaptureText {
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

const FR: LeadCaptureText = {
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
