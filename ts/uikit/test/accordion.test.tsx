import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../src/components/accordion";

function tree(props = {}) {
  return (
    <Accordion {...props}>
      <AccordionItem value="a">
        <AccordionTrigger>A</AccordionTrigger>
        <AccordionContent>body-a</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>B</AccordionTrigger>
        <AccordionContent>body-b</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

describe("Accordion", () => {
  it("opens an item on trigger click and flips data-state", () => {
    const { getByText, queryByText } = render(tree());
    expect(queryByText("body-a")).toBeNull();
    fireEvent.click(getByText("A"));
    expect(getByText("body-a")).toBeInTheDocument();
    expect(getByText("A")).toHaveAttribute("data-state", "open");
    expect(getByText("A")).toHaveAttribute("aria-expanded", "true");
  });

  it("single type closes the previous item when another opens", () => {
    const { getByText, queryByText } = render(tree());
    fireEvent.click(getByText("A"));
    fireEvent.click(getByText("B"));
    expect(queryByText("body-a")).toBeNull();
    expect(getByText("body-b")).toBeInTheDocument();
  });

  it("multiple type keeps several items open", () => {
    const { getByText } = render(tree({ type: "multiple" }));
    fireEvent.click(getByText("A"));
    fireEvent.click(getByText("B"));
    expect(getByText("body-a")).toBeInTheDocument();
    expect(getByText("body-b")).toBeInTheDocument();
  });

  it("collapsible single re-click closes the open item", () => {
    const { getByText, queryByText } = render(tree({ collapsible: true }));
    fireEvent.click(getByText("A"));
    fireEvent.click(getByText("A"));
    expect(queryByText("body-a")).toBeNull();
  });
});
