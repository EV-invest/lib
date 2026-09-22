import * as React from "react";
import { Container } from "./container";

/**
 * A 12-col footer grid — brand 3 | sitemap groups 2 each | offices 3 |
 * newsletter 2 — with the legal links and copyright line. On mobile the sitemap
 * columns sit side by side. The kit brings no content of its own: every string,
 * the mark and the lock-up are the caller's, and each column renders only when
 * it has something in it. `children` render right after the `<footer>` tag —
 * the slot for app-side extras like a build-version easter egg.
 *
 * The lock-up is either composed from `mark` + `brand` + `tagline`, or handed
 * over whole as `lockup` when a brand's arrangement is not that one.
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
  /** The whole lock-up; replaces the one `mark` + `brand` + `tagline` compose. */
  lockup?: React.ReactNode;
  /** The wordmark beside the mark, set in the display family. */
  brand?: string;
  /** The mark beside the brand name. Sized by the caller. */
  mark?: React.ReactNode;
  tagline?: string;
  description?: React.ReactNode;
  copyright?: React.ReactNode;
  nav?: readonly FooterLinkGroup[];
  offices?: readonly FooterOffice[];
  officesHeading?: string;
  legalLinks?: readonly FooterLink[];
  /** The newsletter form; the newsletter column renders only when present. */
  newsletter?: React.ReactNode;
  newsletterHeading?: string;
  newsletterBlurb?: string;
  version?: string;
  commitHref?: string;
  linkComponent?: React.ElementType;
  children?: React.ReactNode;
}

const HEADING = "font-mono text-xs text-ink uppercase tracking-widest mb-6";

export function Footer({
  lockup,
  brand,
  mark,
  tagline,
  description,
  copyright,
  nav = [],
  offices = [],
  officesHeading = "Offices",
  legalLinks = [],
  newsletter,
  newsletterHeading = "Newsletter",
  newsletterBlurb = "",
  version,
  commitHref,
  linkComponent,
  children,
}: FooterProps) {
  const L = linkComponent ?? "a";
  const composed = brand !== undefined || mark !== undefined;
  const hasBrandColumn = lockup !== undefined || composed || description !== undefined || legalLinks.length > 0;

  return (
    <footer data-slot="footer" className="bg-background border-t border-ink/10 py-16">
      {children}
      <Container>
        <div className="grid grid-cols-2 gap-x-8 gap-y-8 lg:grid-cols-12 mb-12">
          {hasBrandColumn && (
            <div className="col-span-2 lg:col-span-3">
              {lockup !== undefined ? (
                <div data-slot="footer-lockup" className="mb-6">{lockup}</div>
              ) : (
                composed && <FooterLockup brand={brand} mark={mark} tagline={tagline} />
              )}
              {description !== undefined && (
                <p className="text-ink/40 text-xs font-light max-w-sm leading-relaxed mb-6">
                  {description}
                </p>
              )}
              {legalLinks.length > 0 && (
                <div className="flex gap-4 text-xs font-mono text-primary-ink">
                  {legalLinks.map((link, i) => (
                    <React.Fragment key={link.label}>
                      {i > 0 && <span className="text-ink/20">|</span>}
                      <L href={link.href} className="hover:underline">
                        {link.label}
                      </L>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          )}

          {nav.map((group) => (
            <nav key={group.heading} aria-label={`Footer ${group.heading} links`} className="lg:col-span-2">
              <h4 className={HEADING}>{group.heading}</h4>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <L
                      href={link.href}
                      className="text-xs font-light text-ink/70 hover:text-primary-ink transition-colors"
                    >
                      {link.label}
                    </L>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {offices.length > 0 && (
            <div className="col-span-2 lg:col-span-3">
              <h4 className={HEADING}>{officesHeading}</h4>
              <ul className="space-y-4 text-xs text-ink/70 font-light leading-relaxed">
                {offices.map((office) => (
                  <li key={office.name}>
                    <strong className="text-ink block font-mono text-[10px] uppercase tracking-wider mb-1">
                      {office.name}
                    </strong>
                    {office.address}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {newsletter && (
            <div className="col-span-2 lg:col-span-2">
              <h4 className={HEADING}>{newsletterHeading}</h4>
              {/* What the source's <Tier tier="alt"><Text> emits: alt body size
                  + the info variant, then the mb-4 the caller adds. */}
              <p className="text-sm sm:text-xs font-light leading-relaxed text-ink/70 mb-4">
                {newsletterBlurb}
              </p>
              {newsletter}
            </div>
          )}
        </div>

        {(copyright !== undefined || version !== undefined) && (
          <div className="border-t border-ink/10 pt-8 text-[10px] font-mono text-ink/40">
            <p>
              {copyright}
              {version && (
                <>
                  {copyright !== undefined && " "}
                  <a href={commitHref} className="text-ink/30">
                    {version}
                  </a>
                </>
              )}
            </p>
          </div>
        )}
      </Container>
    </footer>
  );
}

function FooterLockup({
  brand,
  mark,
  tagline,
}: {
  brand: string | undefined;
  mark: React.ReactNode;
  tagline: string | undefined;
}) {
  return (
    <div data-slot="footer-lockup" className="flex items-center gap-3 mb-6">
      {mark}
      {(brand !== undefined || tagline !== undefined) && (
        <div className="flex flex-col">
          {brand !== undefined && (
            <span className="font-serif font-bold text-base tracking-wider text-ink">{brand}</span>
          )}
          {tagline !== undefined && (
            <span className="text-[8px] font-mono tracking-[0.3em] text-primary-ink uppercase">
              {tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
