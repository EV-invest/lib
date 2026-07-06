import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { NotFound, Forbidden, ServerError, StatusScreen } from "../src/components/status-screen";

describe("StatusScreen", () => {
  it("renders the code, eyebrow, headline and CTAs as plain <a> by default", () => {
    const { getByText } = render(
      <StatusScreen
        accent="teal"
        eyebrow="Page not found"
        code="404"
        headlineLead="You've reached "
        headlineAccent="open water"
        subtext="drifted off"
        links={[{ label: "Back to home", href: "/", leadingArrow: true }]}
      />,
    );
    expect(getByText("404")).toBeInTheDocument();
    expect(getByText("Page not found")).toBeInTheDocument();
    expect(getByText("open water")).toBeInTheDocument();
    const cta = getByText("Back to home").closest("a")!;
    expect(cta.tagName).toBe("A");
    expect(cta).toHaveAttribute("href", "/");
  });

  it("routes CTAs through a custom linkComponent", () => {
    const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
      <a data-testid="custom-link" href={href}>
        {children}
      </a>
    );
    const { getAllByTestId } = render(<NotFound linkComponent={Link} homeHref="/cabinet" />);
    const links = getAllByTestId("custom-link");
    expect(links.some((l) => l.getAttribute("href") === "/cabinet")).toBe(true);
  });

  it("NotFound / Forbidden bake in their code + hrefs", () => {
    const nf = render(<NotFound homeHref="/" contactHref="/contact" />);
    expect(nf.getByText("404")).toBeInTheDocument();
    expect(nf.getByText("Back to home").closest("a")).toHaveAttribute("href", "/");
    expect(nf.getByText("Contact the team").closest("a")).toHaveAttribute("href", "/contact");

    const fb = render(<Forbidden />);
    expect(fb.getByText("403")).toBeInTheDocument();
    expect(fb.getByText("Request access")).toBeInTheDocument();
  });

  it("ServerError shows 500 and its retry button calls reset", () => {
    const reset = vi.fn();
    const { getByText } = render(<ServerError reset={reset} />);
    expect(getByText("500")).toBeInTheDocument();
    fireEvent.click(getByText("Try again"));
    expect(reset).toHaveBeenCalledOnce();
  });
});
