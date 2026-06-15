import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../src/components/tabs";

function tree(props = {}) {
  return (
    <Tabs defaultValue="one" {...props}>
      <TabsList>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
      </TabsList>
      <TabsContent value="one">panel-one</TabsContent>
      <TabsContent value="two">panel-two</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("shows only the active panel with the right roles", () => {
    const { getByText, queryByText, getByRole } = render(tree());
    expect(getByRole("tablist")).toBeInTheDocument();
    expect(getByText("panel-one")).toHaveAttribute("role", "tabpanel");
    expect(queryByText("panel-two")).toBeNull();
    expect(getByText("One")).toHaveAttribute("aria-selected", "true");
    expect(getByText("One")).toHaveAttribute("data-state", "active");
  });

  it("switches panels when another trigger is clicked", () => {
    const { getByText, queryByText } = render(tree());
    fireEvent.click(getByText("Two"));
    expect(getByText("panel-two")).toBeInTheDocument();
    expect(queryByText("panel-one")).toBeNull();
    expect(getByText("Two")).toHaveAttribute("aria-selected", "true");
  });

  it("moves roving focus with the arrow keys", () => {
    const { getByText, getByRole } = render(tree());
    expect(getByText("One")).toHaveAttribute("tabindex", "0");
    expect(getByText("Two")).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(getByRole("tablist"), { key: "ArrowRight" });
    expect(getByText("Two")).toHaveAttribute("tabindex", "0");
    expect(getByText("One")).toHaveAttribute("tabindex", "-1");
  });
});
