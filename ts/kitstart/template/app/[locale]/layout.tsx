import "../globals.css";
import { loadLocale, metadataBase } from "@evinvest/kitstart/next";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { site } from "@/shared/config/site";
import { text } from "@/shared/ui/fonts";

/**
 * The root layout lives under `[locale]` so `<html lang>` is the page's own
 * language on the first byte. The brand scope and the polarity sit on
 * `<html>`, so overlays portalled to `body` stay inside both.
 */
export const metadata: Metadata = {
  metadataBase: metadataBase(site),
  applicationName: site.brand.name,
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await loadLocale(site, params);
  return (
    <html lang={locale} data-brand={site.brand.id} className={`light ${text.variable}`}>
      <body>{children}</body>
    </html>
  );
}
