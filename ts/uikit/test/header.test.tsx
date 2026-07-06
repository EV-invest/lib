import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Header } from "../src/components/header";

// Fragment hrefs: clicking a path href makes jsdom warn "not implemented:
// navigation" — fragments keep the suite's stderr clean.
const NAV = [
  { label: "Portfolio", href: "#portfolio" },
  { label: "Team", href: "#team" },
];

afterEach(() => {
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});

describe("Header", () => {
  it("renders the brand lockup link and desktop nav", () => {
    const { getByLabelText, getByText } = render(
      <Header nav={NAV} homeHref="/home" tagline="Custom Fund" />,
    );
    const brand = getByLabelText("EV Investment — home");
    expect(brand.tagName).toBe("A");
    expect(brand).toHaveAttribute("href", "/home");
    expect(getByText("EV INVESTMENT")).toBeInTheDocument();
    expect(getByText("Custom Fund")).toBeInTheDocument();
    expect(getByText("Portfolio")).toHaveAttribute("href", "#portfolio");
  });

  it("turns opaque once scrolled past 50px", () => {
    const { container } = render(<Header nav={NAV} />);
    const header = container.querySelector('[data-slot="header"]')!;
    expect(header).toHaveClass("bg-transparent");
    Object.defineProperty(window, "scrollY", { value: 120, configurable: true });
    fireEvent.scroll(window);
    expect(header).toHaveClass("bg-main-black/90", "backdrop-blur-md");
  });

  it("opens the mobile overlay, locks scroll, and closes on nav click", () => {
    const { getByLabelText, queryByLabelText, getAllByText } = render(
      <Header nav={NAV} />,
    );
    fireEvent.click(getByLabelText("Open menu"));
    expect(getByLabelText("Close menu")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    const overlayLink = getAllByText("Team").at(-1)!;
    fireEvent.click(overlayLink);
    expect(queryByLabelText("Close menu")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes the mobile overlay on Escape", () => {
    const { getByLabelText, queryByLabelText } = render(<Header nav={NAV} />);
    fireEvent.click(getByLabelText("Open menu"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(queryByLabelText("Close menu")).toBeNull();
  });

  it("compact variant is a fixed opaque bar that ignores scroll", () => {
    const { container } = render(<Header nav={NAV} variant="compact" />);
    const header = container.querySelector('[data-slot="header"]')!;
    expect(header).toHaveAttribute("data-variant", "compact");
    expect(header).toHaveClass("h-16", "bg-main-black/90");
    // No scroll-driven growth: it stays opaque and never turns transparent.
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    fireEvent.scroll(window);
    expect(header).not.toHaveClass("bg-transparent");
  });

  it("hideNav drops the desktop nav and the mobile menu trigger", () => {
    const { queryByText, queryByLabelText } = render(
      <Header nav={NAV} hideNav />,
    );
    expect(queryByText("Portfolio")).toBeNull();
    expect(queryByLabelText("Open menu")).toBeNull();
  });
});
