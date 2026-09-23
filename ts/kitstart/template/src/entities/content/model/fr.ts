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

export const FR = {
  pages: {
    home: { title: f => `Ménage à ${f.place}`, description: f => `Ménage à ${f.place} : un prix fixe annoncé avant de venir.` },
    prices: { title: () => "Nos prix", description: f => `Tous nos prix à ${f.place}.` },
  },
  quoteForm: {
    title: "Recevoir un prix",
    lede: "Réponse dans l’heure.",
    submit: "Recevoir le prix",
    privacy: "Votre numéro ne sert qu’à vous répondre.",
    reassurance: () => "Sans engagement.",
    honeypotLabel: "Site web",
  },
  notFound: status("404", "Page introuvable", ["Cette page ", "n’existe pas."], "Le lien est peut-être ancien."),
  serverError: status("500", "Erreur", ["Un problème ", "de notre côté."], "Réessayez dans un instant."),
  thanks: status("✓", "Demande reçue", ["Merci, ", "nous vous rappelons."], "Nous avons bien reçu votre demande."),
  callLabel: f => (f.phone ? `Appeler le ${f.phone}` : "Nous appeler"),
  whatsappLabel: "WhatsApp",
  whatsappShort: "WhatsApp",
  whatsappMessage: f => `Bonjour, je vous contacte depuis la page de ${f.place}.`,
  ctaShort: "Devis",
  backHome: "Retour à l’accueil",
  tryAgain: "Réessayer",
  statusStrip: ["Prix fixe", "Sans engagement"],
  langName: "Français",
  facts: () => ["Brand SAS"],
  hero: { title: f => `Le ménage à ${f.place}, à prix fixe.`, lede: "Un prix annoncé avant de venir." },
  coverageTitle: "Où nous intervenons",
  brandPage: { title: "Brand", description: "Le ménage à prix fixe.", open: "Ouvrir" },
  contactLabel: "Nous contacter",
  subjects: { standard: "Ménage courant", deep: "Grand ménage", other: "Autre" },
  quoteLabels: { subject: "Prestation", locality: "Ville ou code postal", mobile: "Mobile" },
  faqs: [{ q: "Le prix peut-il changer ?", a: "Non : le prix annoncé est celui que vous payez." }],
} satisfies Text;
