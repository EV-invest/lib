import * as React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Footer } from "../src/components/footer";

const NAV = [
  { heading: "Company", links: [{ label: "Home", href: "/" }] },
  { heading: "Explore", links: [{ label: "Portfolio", href: "/#portfolio" }] },
];

describe("Footer", () => {
  it("renders sitemap groups, EV default copy, offices and legal links", () => {
    const { getByRole, getByText } = render(<Footer nav={NAV} />);
    expect(
      getByRole("navigation", { name: "Footer Company links" }),
    ).toBeInTheDocument();
    expect(getByText("Home")).toHaveAttribute("href", "/");
    expect(getByText(/registered real estate advisory/)).toBeInTheDocument();
    expect(getByText("Quy Nhon Head Office")).toBeInTheDocument();
    expect(getByText("Privacy Policy")).toHaveAttribute("href", "#hero");
    expect(getByText(/© 2026 EV Investment/)).toBeInTheDocument();
  });

  it("renders the Newsletter column only when the slot is given", () => {
    const { queryByText, rerender, getByText, getByTestId } = render(
      <Footer nav={NAV} />,
    );
    expect(queryByText("Newsletter")).toBeNull();
    rerender(<Footer nav={NAV} newsletter={<form data-testid="nl" />} />);
    expect(getByText("Newsletter")).toBeInTheDocument();
    expect(
      getByText("Subscribe, to receive our macro reports"),
    ).toBeInTheDocument();
    expect(getByTestId("nl")).toBeInTheDocument();
  });

  it("links the build version only when given", () => {
    const { getByText } = render(
      <Footer nav={NAV} version="abc1234" commitHref="https://example.com/c" />,
    );
    expect(getByText("abc1234")).toHaveAttribute("href", "https://example.com/c");
    const { container } = render(<Footer nav={NAV} />);
    expect(container.querySelector('a[class*="text-main-mist/30"]')).toBeNull();
  });

  it("renders children right after the footer tag and uses linkComponent", () => {
    const Fancy = (props: React.ComponentProps<"a">) => (
      <a data-fancy="" {...props} />
    );
    const { container, getByText } = render(
      <Footer nav={NAV} linkComponent={Fancy}>
        <div data-testid="extras" />
      </Footer>,
    );
    const footer = container.querySelector('[data-slot="footer"]')!;
    expect(footer.firstElementChild).toHaveAttribute("data-testid", "extras");
    expect(getByText("Home")).toHaveAttribute("data-fancy");
  });
});
