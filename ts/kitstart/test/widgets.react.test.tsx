import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { contactOf, createAcceptLead, placeUrl, RateLimiter, type Place, type StatusCopy, type StatusScreenText } from "../src/index";
import { AreaChips, CallBar, Coverage, Faq, LangSwitch, PlaceDirectory, QuoteFormShell, StatusScreen, withLang } from "../src/react/index";
import { fixtureSite } from "./support/fixtures";

const site = fixtureSite("aquafix");
const cleaning = fixtureSite("cleaning");
const royat = site.places[0] as Place<"fr" | "en">;
const paris = cleaning.places[0] as Place<"fr" | "en">;
type F = { phone: string };
const f: F = { phone: "+33 4 23 50 06 40" };

describe("LangSwitch", () => {
  it("links every language through ?lang= and marks the current one", () => {
    render(<LangSwitch current="en" locales={["fr", "en"]} hrefs={{ fr: "/fr/prices", en: "/en/prices" }} />);
    expect(screen.getByText("FR")).toHaveAttribute("href", "/fr/prices?lang=fr");
    expect(screen.getByText("EN")).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("FR")).not.toHaveAttribute("aria-current");
  });

  it("names each language to a screen reader, and keeps a link's query and fragment", () => {
    render(<LangSwitch current="fr" locales={["fr", "en"]} hrefs={{ fr: "/fr?x=1#faq", en: "/en" }} labels={{ fr: "Français", en: "English" }} label="Langue" />);
    expect(screen.getByRole("navigation", { name: "Langue" })).toBeInTheDocument();
    expect(screen.getByLabelText("English")).toHaveAttribute("href", "/en?lang=en");
    expect(screen.getByLabelText("Français")).toHaveAttribute("href", "/fr?x=1&lang=fr#faq");
  });

  it("keeps an absolute link's origin", () => {
    expect(withLang("https://royat.aquafix.top/fr/prices?x=1#faq", "en")).toBe("https://royat.aquafix.top/fr/prices?x=1&lang=en#faq");
    expect(withLang("//royat.aquafix.top/fr", "en")).toBe("//royat.aquafix.top/fr?lang=en");
    expect(withLang("http://localhost:3000/fr", "fr")).toBe("http://localhost:3000/fr?lang=fr");
  });
});

describe("CallBar", () => {
  const copy = { locale: "fr" as const, f, t: { callLabel: (x: F) => `Appeler ${x.phone}`, whatsappMessage: () => "Bonjour", whatsappShort: "WhatsApp", ctaShort: "Devis" } };

  it("offers the phone, WhatsApp and the form", () => {
    render(<CallBar copy={copy} phone="+33 4 23 50 06 40" whatsapp="+33 6 12 34 56 78" quoteHref="/fr#quote" label="Contact" />);
    expect(screen.getByLabelText("Appeler +33 4 23 50 06 40")).toHaveAttribute("href", "tel:+33423500640");
    expect(screen.getByText("WhatsApp").closest("a")).toHaveAttribute("href", "https://wa.me/33612345678?text=Bonjour");
    expect(screen.getByText("Devis").closest("a")).toHaveAttribute("data-intent", "form_open");
  });

  it("leaves out a channel the place does not have", () => {
    render(<CallBar copy={copy} phone={null} whatsapp={null} quoteHref="/fr#quote" label="Contact" />);
    expect(screen.queryByText("☎")).toBeNull();
    expect(screen.queryByText("WhatsApp")).toBeNull();
    expect(screen.getByText("Devis")).toBeInTheDocument();
  });
});

describe("StatusScreen", () => {
  const t: StatusScreenText<F> = {
    callLabel: x => `Appeler ${x.phone}`,
    backHome: "Accueil",
    tryAgain: "Réessayer",
    statusStrip: ["Prix fixe", "Garantie 12 mois"],
    facts: () => ["SIRET 000", "Décennale —"],
  };
  const notFound: StatusCopy<F> = {
    code: "404",
    title: "Introuvable",
    eyebrow: "ERREUR",
    headline: ["Cette page ", "n’existe pas"],
    body: () => "Mais nous oui.",
    primary: "call",
    secondary: "home",
  };
  const target = { phone: "+33 4 23 50 06 40", home: "/fr", retry: "/fr", langHrefs: { fr: "/fr", en: "/en" } };

  it("prints the status, the offer strip, the facts and the phone", () => {
    render(<StatusScreen copy={{ locale: "fr", t, f }} status={notFound} target={target} locales={["fr", "en"]} brandName="Aquafix" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cette page n’existe pas");
    expect(screen.getByText("Appeler +33 4 23 50 06 40").closest("a")).toHaveAttribute("href", "tel:+33423500640");
    expect(screen.getByText("Accueil").closest("a")).toHaveAttribute("href", "/fr");
    expect(screen.getByText("SIRET 000 · Décennale —").closest("footer")).toHaveClass("uppercase");
    expect(screen.getByLabelText("Aquafix")).toHaveAttribute("href", "/fr");
  });

  it("never renders a dead call button for a brand with no phone", () => {
    render(<StatusScreen copy={{ locale: "fr", t, f }} status={notFound} target={{ ...target, phone: null }} locales={["fr", "en"]} brandName="Clean" />);
    expect(screen.queryByText(/Appeler/)).toBeNull();
    // The primary falls back to home, and the duplicate secondary is dropped.
    expect(screen.getAllByText("Accueil")).toHaveLength(1);
  });

  it("styles each part the brand names", () => {
    const classNames = { header: "py-2", eyebrow: "text-sm", code: "text-7xl", headline: "text-3xl", body: "text-sm", actions: "gap-2" } as const;
    render(<StatusScreen copy={{ locale: "fr", t, f }} status={notFound} target={target} locales={["fr", "en"]} brandName="Aquafix" classNames={classNames} />);
    expect(screen.getByLabelText("Aquafix").closest("header")).toHaveClass("py-2");
    expect(screen.getByText("ERREUR")).toHaveClass("text-sm");
    expect(screen.getByText("404")).toHaveClass("text-7xl");
    expect(screen.getByText("404")).not.toHaveClass("text-8xl");
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("text-3xl");
    expect(screen.getByText("Mais nous oui.")).toHaveClass("text-sm");
    expect(screen.getByText("Accueil").closest("a")?.parentElement).toHaveClass("gap-2");
  });

  it("lets a brand keep the language switch on the header's row", () => {
    const { unmount } = render(<StatusScreen copy={{ locale: "fr", t, f }} status={notFound} target={target} locales={["fr", "en"]} brandName="Aquafix" />);
    expect(screen.getByRole("navigation")).toHaveClass("order-last", "w-full");
    unmount();
    render(<StatusScreen copy={{ locale: "fr", t, f }} status={notFound} target={target} locales={["fr", "en"]} brandName="Aquafix" classNames={{ lang: "order-none w-auto" }} />);
    const nav = screen.getByRole("navigation");
    expect(nav.parentElement?.tagName).toBe("HEADER");
    expect(nav).toHaveClass("order-none", "w-auto", "md:order-none");
    expect(nav).not.toHaveClass("order-last", "w-full");
  });

  // Shown dark inside a light page, uncoloured text would take the <body>'s ink.
  it("carries its own ink, a legible outline border and an unbreakable phone", () => {
    const { container } = render(
      <StatusScreen copy={{ locale: "fr", t, f }} status={notFound} target={target} locales={["fr", "en"]} brandName="Aquafix" classNames={{ phone: "text-lg", secondaryButton: "px-4" }} />,
    );
    expect(container.firstElementChild).toHaveClass("text-ink");
    expect(screen.getByText("Accueil").closest("a")).toHaveClass("border-ink/50", "px-4");
    const phone = screen.getAllByText("+33 4 23 50 06 40").find(el => el.closest("header"));
    expect(phone).toHaveClass("whitespace-nowrap", "text-lg");
    expect(phone).not.toHaveClass("text-base");
  });
});

describe("PlaceDirectory", () => {
  it("links each place to its canonical home with its phone, and prints no address for a service area", () => {
    const places = [royat, { ...paris, slug: "paris" }];
    render(
      <PlaceDirectory
        places={places}
        locale="fr"
        hrefOf={p => placeUrl(site, p.slug, "fr", "")}
        phoneOf={p => contactOf(site, p).phone}
        openLabel="Ouvrir"
      />,
    );
    const links = screen.getAllByText(/Ouvrir/);
    expect(links[0]).toHaveAttribute("href", "https://royat.aquafix.top/fr");
    expect(screen.getByText(/2 Av\. Abbé Védrine/)).toBeInTheDocument();
    expect(document.querySelectorAll("address")).toHaveLength(1);
  });
});

describe("Coverage", () => {
  it("shows a storefront's map behind a click, and a service area only its chips", () => {
    const { unmount } = render(<Coverage place={royat} locale="fr" map={{ title: "Carte", show: "Voir la carte" }} />);
    expect(screen.getByText("Royat")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByText("Voir la carte"));
    expect(document.querySelector("iframe")?.getAttribute("src")).toContain("output=embed");
    unmount();
    render(<Coverage place={paris} locale="fr" map={{ title: "Carte", show: "Voir la carte" }} />);
    expect(screen.getByText("Boulogne-Billancourt")).toBeInTheDocument();
    expect(screen.queryByText("Voir la carte")).toBeNull();
  });

  it("renders nothing for no areas", () => {
    const { container } = render(<AreaChips areas={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Faq", () => {
  it("is <details>, opening without a script", () => {
    render(<Faq items={[{ q: "Q1", a: "A1" }]} />);
    expect(screen.getByText("Q1").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("A1")).toBeInTheDocument();
  });
});

// A part's class replaces the kit's conflicting utility, not joins it:
// that is what lets a brand set geometry without descendant selectors.
describe("named parts", () => {
  it("reach their element and win over the kit's own classes", () => {
    const { unmount } = render(<Faq items={[{ q: "Q1", a: "A1" }]} classNames={{ list: "rounded-none", answer: "px-2" }} />);
    expect(screen.getByText("Q1").closest("details")?.parentElement).toHaveClass("rounded-none");
    expect(screen.getByText("Q1").closest("details")?.parentElement).not.toHaveClass("rounded-xl");
    expect(screen.getByText("A1")).toHaveClass("px-2");
    expect(screen.getByText("A1")).not.toHaveClass("px-5");
    unmount();

    const copy = { locale: "fr" as const, f, t: { callLabel: (x: F) => `Appeler ${x.phone}`, whatsappMessage: () => "Bonjour", whatsappShort: "WhatsApp", ctaShort: "Devis" } };
    render(<CallBar copy={copy} phone="+33 4 23 50 06 40" whatsapp={null} quoteHref="/fr#quote" label="Contact" buttonClassName="font-bold" classNames={{ call: "px-6" }} />);
    expect(screen.getByLabelText("Appeler +33 4 23 50 06 40")).toHaveClass("px-6", "font-bold");
    expect(screen.getByText("Devis").closest("a")).not.toHaveClass("px-6");
  });

  it("style every place card and the coverage chips", () => {
    render(
      <PlaceDirectory places={[royat]} locale="fr" hrefOf={() => "/"} phoneOf={() => null} openLabel="Ouvrir" classNames={{ list: "gap-2", card: "p-3" }} />,
    );
    expect(screen.getByText("Royat").closest("li")).toHaveClass("p-3");
    expect(screen.getByText("Royat").closest("ul")).toHaveClass("gap-2");
    render(<Coverage place={paris} locale="fr" classNames={{ chips: "gap-1", chip: "px-3" }} />);
    expect(screen.getByText("Boulogne-Billancourt").closest("ul")).toHaveClass("gap-1");
    expect(screen.getByText("Boulogne-Billancourt").tagName).toBe("LI");
    expect(screen.getByText("Boulogne-Billancourt")).toHaveClass("px-3");
    expect(screen.getByText("Boulogne-Billancourt")).not.toHaveClass("px-4");
  });

  it("style the coverage map button's two lines", () => {
    render(<Coverage place={royat} locale="fr" map={{ title: "Carte", show: "Voir la carte" }} classNames={{ mapShow: "text-base", mapAddress: "text-xs" }} />);
    const show = screen.getByText("Voir la carte");
    expect(show.closest("button")).not.toBeNull();
    expect(show).toHaveClass("text-base");
    expect(show).not.toHaveClass("text-lg");
    const address = show.nextElementSibling;
    expect(address).toHaveClass("text-xs");
    expect(address).not.toHaveClass("text-sm");
  });
});

describe("QuoteFormShell", () => {
  it("posts what the funnel reads — and the funnel accepts it", async () => {
    const NOW = 1_800_000_000_000;
    render(
      <QuoteFormShell placeSlug="royat" locale="en" renderedAt={NOW - 10_000} honeypotLabel="Website">
        <input name="job" defaultValue="other" />
        <input name="zip" defaultValue="63130" />
        <input name="mobile" defaultValue="0612345678" />
      </QuoteFormShell>,
    );
    const form = document.querySelector("form#quote");
    if (!(form instanceof HTMLFormElement)) throw new Error("no form");
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/quote");
    const insert = vi.fn(async () => 1);
    const outcome = await createAcceptLead(site)(new FormData(form), "k", {
      insert,
      defer: () => undefined,
      notify: async () => undefined,
      capture: () => undefined,
      limiter: new RateLimiter(5, 60_000),
      now: NOW,
      log: { warn: vi.fn(), error: vi.fn() },
    });
    expect(outcome).toMatchObject({ kind: "stored", locale: "en", formId: "quote", lead: { placeSlug: "royat", subject: "other", spamVerdict: null } });
  });

  it("carries no place on the brand's own pages", () => {
    render(
      <QuoteFormShell placeSlug={null} locale="fr" renderedAt={0} honeypotLabel="Website">
        <span />
      </QuoteFormShell>,
    );
    expect(document.querySelector('input[name="location"]')).toBeNull();
    expect(document.querySelector('input[name="hp_ref"]')?.getAttribute("tabindex")).toBe("-1");
  });
});
