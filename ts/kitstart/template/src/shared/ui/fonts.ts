import localFont from "next/font/local";

/**
 * The brand's faces, served from the site itself: no request to a font CDN,
 * and no layout shift once they load. Paths must be literals — Next reads
 * this call statically. The shipped face is Inter, cut to the Latin range the
 * copy uses; replace it with the brand's (and re-cut to the copy's glyphs).
 */
export const text = localFont({
  src: "../../../assets/fonts/Inter-Regular.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-sans",
});
