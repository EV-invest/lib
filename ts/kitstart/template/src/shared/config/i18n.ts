import { createLocaleRegistry } from "@evinvest/kitstart";

/**
 * Every language carries a prefix: a new site launches with no legacy URLs to
 * keep. The default is what a header-less crawler is sent to.
 */
export const i18n = createLocaleRegistry({
  locales: ["fr", "en"],
  labels: { fr: "Français", en: "English" },
  default: "fr",
  prefixDefaultLocale: true,
  hreflang: { fr: "fr-FR" },
});

export type Locale = (typeof i18n.locales)[number];
