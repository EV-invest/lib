import type { StatusCopy } from "@evinvest/kitstart";
import type { Facts, Text } from "./types";

const status = (code: string, title: string, headline: readonly [string, string], body: string): StatusCopy<Facts> => ({
  code,
  title,
  eyebrow: title.toUpperCase(),
  headline,
  body: () => body,
  primary: "call",
  secondary: "home",
});

export const EN = {
  pages: {
    home: { title: f => `Cleaning in ${f.place}`, description: f => `Cleaning in ${f.place}: a fixed price, quoted before we come.` },
    prices: { title: () => "Our prices", description: f => `Every price in ${f.place}.` },
  },
  quoteForm: {
    title: "Get a price",
    lede: "An answer within the hour.",
    submit: "Get the price",
    privacy: "Your number is used only to answer you.",
    reassurance: () => "No commitment.",
    honeypotLabel: "Website",
  },
  notFound: status("404", "Page not found", ["This page ", "does not exist."], "The link may be old."),
  serverError: status("500", "Error", ["Something broke ", "on our side."], "Try again in a moment."),
  thanks: status("✓", "Request received", ["Thank you, ", "we will call you back."], "We have your request."),
  callLabel: f => (f.phone ? `Call ${f.phone}` : "Call us"),
  whatsappLabel: "WhatsApp",
  whatsappShort: "WhatsApp",
  whatsappMessage: f => `Hello, I am writing from the ${f.place} page.`,
  ctaShort: "Quote",
  backHome: "Back home",
  tryAgain: "Try again",
  statusStrip: ["Fixed price", "No commitment"],
  langName: "English",
  facts: () => ["Brand SAS"],
  hero: { title: f => `Cleaning in ${f.place}, at a fixed price.`, lede: "A price quoted before we come." },
  coverageTitle: "Where we work",
  subjects: { standard: "Regular cleaning", deep: "Deep cleaning", other: "Other" },
  quoteLabels: { subject: "Service", locality: "Town or postcode", mobile: "Mobile" },
  faqs: [{ q: "Can the price change?", a: "No: the price quoted is the price you pay." }],
} satisfies Text;
