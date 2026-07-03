import * as React from "react";
import { Container } from "./container";
import { Logo } from "./logo";

/**
 * The EV brand chrome footer, ported from site_conductor: a 12-col grid —
 * brand 3 | sitemap groups 2 each | Offices 3 | Newsletter 2 — over the dark
 * field, with the legal links and copyright line. On mobile the sitemap
 * columns sit side by side. All copy is parameterized with the EV defaults so
 * a bare `<Footer nav={…} />` matches the site; only the sitemap groups (and
 * the newsletter form, when wanted) come from the app. `children` render right
 * after the `<footer>` tag — the slot for app-side extras like the
 * build-version easter egg.
 *
 * `linkComponent` lets Next hosts pass `next/link`; everyone else gets `<a>`.
 */
export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterLinkGroup {
  heading: string;
  links: readonly FooterLink[];
}

export interface FooterOffice {
  name: string;
  address: string;
}

export interface FooterProps {
  nav: readonly FooterLinkGroup[];
  description?: string;
  offices?: readonly FooterOffice[];
  legalLinks?: readonly FooterLink[];
  /** The newsletter form; the Newsletter column renders only when present. */
  newsletter?: React.ReactNode;
  newsletterBlurb?: string;
  version?: string;
  commitHref?: string;
  tagline?: string;
  linkComponent?: React.ElementType;
  children?: React.ReactNode;
}

const DEFAULT_DESCRIPTION =
  "EV Investment is a registered real estate advisory and investment management fund specializing in premium coastal developments in Quy Nhon, Binh Dinh province, Vietnam.";

const DEFAULT_OFFICES: readonly FooterOffice[] = [
  {
    name: "Quy Nhon Head Office",
    address: "102 An Duong Vuong St, Nguyen Van Cu Ward, Quy Nhon City, Vietnam",
  },
  {
    name: "Ho Chi Minh Representative",
    address: "Deutsches Haus, 33 Le Duan Blvd, District 1, Ho Chi Minh City, Vietnam",
  },
];

const DEFAULT_LEGAL_LINKS: readonly FooterLink[] = [
  { label: "Privacy Policy", href: "#hero" },
  { label: "Terms of Service", href: "#hero" },
];

export function Footer({
  nav,
  description = DEFAULT_DESCRIPTION,
  offices = DEFAULT_OFFICES,
  legalLinks = DEFAULT_LEGAL_LINKS,
  newsletter,
  newsletterBlurb = "Subscribe, to receive our macro reports",
  version,
  commitHref,
  tagline = "Quy Nhon Fund",
  linkComponent,
  children,
}: FooterProps) {
  const L = linkComponent ?? "a";

  return (
    <footer
      data-slot="footer"
      className="bg-main-black border-t border-main-mist/10 py-16"
    >
      {children}
      <Container>
        <div className="grid grid-cols-2 gap-x-8 gap-y-8 lg:grid-cols-12 mb-12">
          <div className="col-span-2 lg:col-span-3">
            <div className="flex items-center gap-3 mb-6">
              <Logo className="w-8 h-8 text-white" />
              <div className="flex flex-col">
                <span className="font-serif-display font-bold text-base tracking-wider text-white">
                  EV INVESTMENT
                </span>
                <span className="text-[8px] font-mono-tech tracking-[0.3em] text-main-accent-t1 uppercase">
                  {tagline}
                </span>
              </div>
            </div>
            <p className="text-main-mist/40 text-xs font-light max-w-sm leading-relaxed mb-6">
              {description}
            </p>
            <div className="flex gap-4 text-xs font-mono-tech text-main-accent-t1">
              {legalLinks.map((link, i) => (
                <React.Fragment key={link.label}>
                  {i > 0 && <span className="text-main-mist/20">|</span>}
                  <L href={link.href} className="hover:underline">
                    {link.label}
                  </L>
                </React.Fragment>
              ))}
            </div>
          </div>

          {nav.map((group) => (
            <nav
              key={group.heading}
              aria-label={`Footer ${group.heading} links`}
              className="lg:col-span-2"
            >
              <h4 className="font-mono-tech text-xs text-white uppercase tracking-widest mb-6">
                {group.heading}
              </h4>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <L
                      href={link.href}
                      className="text-xs font-light text-main-mist/70 hover:text-main-accent-t1 transition-colors"
                    >
                      {link.label}
                    </L>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="col-span-2 lg:col-span-3">
            <h4 className="font-mono-tech text-xs text-white uppercase tracking-widest mb-6">
              Offices
            </h4>
            <ul className="space-y-4 text-xs text-main-mist/70 font-light leading-relaxed">
              {offices.map((office) => (
                <li key={office.name}>
                  <strong className="text-white block font-mono-tech text-[10px] uppercase tracking-wider mb-1">
                    {office.name}
                  </strong>
                  {office.address}
                </li>
              ))}
            </ul>
          </div>

          {newsletter && (
            <div className="col-span-2 lg:col-span-2">
              <h4 className="font-mono-tech text-xs text-white uppercase tracking-widest mb-6">
                Newsletter
              </h4>
              {/* What the source's <Tier tier="alt"><Text> emits: alt body size
                  + the info variant, then the mb-4 the caller adds. */}
              <p className="text-sm sm:text-xs font-light leading-relaxed text-main-mist/70 mb-4">
                {newsletterBlurb}
              </p>
              {newsletter}
            </div>
          )}
        </div>

        <div className="border-t border-main-mist/10 pt-8 text-[10px] font-mono-tech text-main-mist/40">
          <p>
            © 2026 EV Investment. All rights reserved.
            {version && (
              <>
                {" "}
                <a href={commitHref} className="text-main-mist/30">
                  {version}
                </a>
              </>
            )}
          </p>
        </div>
      </Container>
    </footer>
  );
}
