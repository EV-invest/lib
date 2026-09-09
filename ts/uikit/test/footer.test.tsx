import * as React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Footer } from "../src/components/footer";

const NAV = [
  { heading: "Company", links: [{ label: "Home", href: "/" }] },
  { heading: "Explore", links: [{ label: "Portfolio", href: "/#portfolio" }] },
];

const COPY = {
  brand: "ACME",
  description: "We do a thing.",
  copyright: "© 2026 ACME",
};

describe("Footer", () => {
  it("renders the caller's copy and omits the empty columns", () => {
    const { getByRole, getByText, queryByText } = render(
      <Footer {...COPY} nav={NAV} />,
    );
    expect(
      getByRole("navigation", { name: "Footer Company links" }),
    ).toBeInTheDocument();
    expect(getByText("Home")).toHaveAttribute("href", "/");
    expect(getByText("We do a thing.")).toBeInTheDocument();
    expect(getByText(/© 2026 ACME/)).toBeInTheDocument();
    expect(queryByText("Offices")).toBeNull();
    expect(queryByText("Newsletter")).toBeNull();
  });

  it("renders the offices and newsletter columns with their data", () => {
    const { getByText, getByTestId } = render(
      <Footer
        {...COPY}
        nav={NAV}
        offices={[{ name: "Head Office", address: "1 Main St" }]}
        legalLinks={[{ label: "Privacy Policy", href: "/privacy" }]}
        newsletterBlurb="Subscribe."
        newsletter={<form data-testid="nl" />}
      />,
    );
    expect(getByText("Head Office")).toBeInTheDocument();
    expect(getByText("Privacy Policy")).toHaveAttribute("href", "/privacy");
    expect(getByText("Newsletter")).toBeInTheDocument();
    expect(getByText("Subscribe.")).toBeInTheDocument();
    expect(getByTestId("nl")).toBeInTheDocument();
  });

  it("links the build version only when given", () => {
    const { getByText } = render(
      <Footer {...COPY} nav={NAV} version="abc1234" commitHref="https://example.com/c" />,
    );
    expect(getByText("abc1234")).toHaveAttribute("href", "https://example.com/c");
    const { container } = render(<Footer {...COPY} nav={NAV} />);
    expect(container.querySelector('a[class*="text-ink/30"]')).toBeNull();
  });

  it("renders children right after the footer tag and uses linkComponent", () => {
    const Fancy = (props: React.ComponentProps<"a">) => (
      <a data-fancy="" {...props} />
    );
    const { container, getByText } = render(
      <Footer {...COPY} nav={NAV} linkComponent={Fancy}>
        <div data-testid="extras" />
      </Footer>,
    );
    const footer = container.querySelector('[data-slot="footer"]')!;
    expect(footer.firstElementChild).toHaveAttribute("data-testid", "extras");
    expect(getByText("Home")).toHaveAttribute("data-fancy");
  });
});
