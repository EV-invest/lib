import * as React from "react";
import { cn } from "../lib/cn";
import { Container } from "./container";
import { Logo } from "./logo";
import { Portal } from "../primitives/portal";

/**
 * The EV brand chrome header, ported from site_conductor: a fixed, scroll-aware
 * bar (transparent over the hero, blurred dark once scrolled past 50px) with
 * the brand lockup, a desktop nav and a built-in below-`lg` full-screen menu.
 * Nav items and the CTA stay app-side — the kit owns only the chrome.
 *
 * `linkComponent` lets Next hosts pass `next/link`; everyone else gets `<a>`.
 */
export interface HeaderNavItem {
  label: string;
  href: string;
}

export interface HeaderProps {
  nav: readonly HeaderNavItem[];
  /** Right-side call-to-action slot; also re-rendered at the mobile menu's bottom. */
  cta?: React.ReactNode;
  tagline?: string;
  homeHref?: string;
  className?: string;
  linkComponent?: React.ElementType;
}

export function Header({
  nav,
  cta,
  tagline = "Quy Nhon Fund",
  homeHref = "/",
  className,
  linkComponent,
}: HeaderProps) {
  const L = linkComponent ?? "a";
  const [hasScrolled, setHasScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => setHasScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      data-slot="header"
      className={cn(
        "fixed top-0 left-0 w-full z-[60] transition-all duration-500 border-b",
        hasScrolled
          ? "bg-main-black/90 backdrop-blur-md border-main-mist/10 py-4"
          : "bg-transparent border-transparent py-6",
        className,
      )}
    >
      <Container className="flex items-center justify-between gap-4">
        <L
          href={homeHref}
          className="flex items-center gap-3"
          aria-label="EV Investment — home"
        >
          <Logo className="w-10 h-10 text-white" />
          <div className="flex flex-col">
            <span className="font-serif-display font-bold text-lg tracking-wider text-white">
              EV INVESTMENT
            </span>
            <span className="text-[9px] font-mono-tech tracking-[0.3em] text-main-accent-t1 uppercase">
              {tagline}
            </span>
          </div>
        </L>

        <nav className="hidden lg:flex items-center gap-6 font-mono-tech text-xs tracking-widest uppercase">
          {nav.map((item) => (
            <L
              key={item.href}
              href={item.href}
              className="text-main-mist/80 hover:text-main-accent-t1 transition-colors"
            >
              {item.label}
            </L>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {cta}
          <MobileMenu nav={nav} cta={cta} linkComponent={L} />
        </div>
      </Container>
    </header>
  );
}

/** Below-`lg` navigation: a full-screen opaque overlay with its own close
 *  button, so a long nav stays reachable on tablet/phone.
 *
 *  The overlay is portalled to `document.body` ON PURPOSE: once scrolled, the
 *  header gains `backdrop-blur`, which makes it the containing block for any
 *  `position: fixed` descendant — that would clamp `inset-0` to the header box
 *  and let the page bleed through. Portalling escapes that. Any `<a>`/`<button>`
 *  click inside the overlay closes it (delegation), so the app-side CTA needs
 *  no wiring. */
function MobileMenu({
  nav,
  cta,
  linkComponent: L,
}: {
  nav: readonly HeaderNavItem[];
  cta?: React.ReactNode;
  linkComponent: React.ElementType;
}) {
  const [open, setOpen] = React.useState(false);

  // Lock body scroll while open and close on Escape.
  React.useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const closeOnNavigation = (e: React.MouseEvent) => {
    if ((e.target as Element).closest("a, button")) setOpen(false);
  };

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(true)}
        className="flex size-10 items-center justify-center text-white"
      >
        <svg
          className="size-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <Portal>
          <div
            onClick={closeOnNavigation}
            className="fixed inset-0 z-[70] flex flex-col bg-main-black px-6 pb-10 duration-200 animate-in fade-in lg:hidden"
          >
            <div className="flex h-20 shrink-0 items-center justify-end">
              <button
                type="button"
                aria-label="Close menu"
                className="flex size-10 items-center justify-center text-white"
              >
                <svg
                  className="size-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col font-mono-tech text-sm uppercase tracking-widest duration-300 ease-out animate-in fade-in slide-in-from-top-4">
              {nav.map((item) => (
                <L
                  key={item.href}
                  href={item.href}
                  className="border-b border-main-mist/10 py-4 text-main-mist/80 transition-colors hover:text-main-accent-t1"
                >
                  {item.label}
                </L>
              ))}
            </nav>
            {cta && <div className="mt-8 w-full block">{cta}</div>}
          </div>
        </Portal>
      )}
    </div>
  );
}
