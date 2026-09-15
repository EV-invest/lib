import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Alert, AlertTitle, AlertDescription } from "../src/components/alert";

describe("Alert", () => {
  it("renders the default variant", () => {
    const { getByRole } = render(<Alert>body</Alert>);
    const el = getByRole("alert");
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveClass("bg-card");
    expect(el).toHaveAttribute("data-slot", "alert");
  });

  it("renders the destructive variant", () => {
    const { getByRole } = render(<Alert variant="destructive">x</Alert>);
    expect(getByRole("alert")).toHaveClass("text-accent-error");
  });

  it("renders the success variant", () => {
    const { getByRole } = render(<Alert variant="success">x</Alert>);
    expect(getByRole("alert")).toHaveClass("text-positive");
  });

  it("renders the info variant", () => {
    const { getByRole } = render(<Alert variant="info">x</Alert>);
    expect(getByRole("alert")).toHaveClass("text-accent-info");
  });

  // the role tint stays on the root (icon + title inherit it); the description
  // child is lifted to ink so body copy and nested controls hold the contrast floor
  it.each(["destructive", "success", "info"] as const)(
    "keeps the %s description in ink",
    (variant) => {
      const { getByRole } = render(
        <Alert variant={variant}>
          <AlertDescription>d</AlertDescription>
        </Alert>,
      );
      const el = getByRole("alert");
      expect(el).toHaveClass("*:data-[slot=alert-description]:text-ink-mid");
      expect(el.className).not.toMatch(/\/90/);
    },
  );

  it("renders title and description slots", () => {
    const { getByText } = render(
      <Alert>
        <AlertTitle>t</AlertTitle>
        <AlertDescription>d</AlertDescription>
      </Alert>,
    );
    expect(getByText("t")).toHaveAttribute("data-slot", "alert-title");
    const desc = getByText("d");
    expect(desc).toHaveAttribute("data-slot", "alert-description");
    expect(desc).toHaveClass("text-ink-soft");
  });

  it("lets className override the base", () => {
    const { getByRole } = render(<Alert className="px-6">x</Alert>);
    const el = getByRole("alert");
    expect(el).toHaveClass("px-6");
    expect(el).not.toHaveClass("px-4");
  });
});
