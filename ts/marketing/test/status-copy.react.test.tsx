import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createStatusCopy } from "../src/react/index";

// Module scope, as the docs require (in an app: a "use client" module).
const { StatusCopyProvider, useStatusCopy } = createStatusCopy<{ title: string }>();

function ErrorPage() {
  const copy = useStatusCopy();
  return <h1>{copy?.title ?? "Something went wrong"}</h1>;
}

describe("createStatusCopy", () => {
  it("hands the provided copy to the client page", () => {
    render(
      <StatusCopyProvider copy={{ title: "Une erreur est survenue" }}>
        <ErrorPage />
      </StatusCopyProvider>,
    );
    expect(screen.getByRole("heading")).toHaveTextContent("Une erreur est survenue");
  });

  it("answers null rather than throwing without a provider", () => {
    render(<ErrorPage />);
    expect(screen.getByRole("heading")).toHaveTextContent("Something went wrong");
  });
});
