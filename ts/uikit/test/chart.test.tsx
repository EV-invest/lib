import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
  type ChartConfig,
} from "../src/components/chart";

const config: ChartConfig = {
  desktop: { label: "Desktop", color: "#3b82f6" },
};

describe("Chart", () => {
  it("container emits the slot, scoped id, and color vars (no recharts)", () => {
    const { container } = render(
      <ChartContainer id="x" config={config}>
        <svg />
      </ChartContainer>,
    );
    const el = container.querySelector('[data-slot="chart"]')!;
    expect(el).toHaveAttribute("data-chart", "chart-x");
    const style = container.querySelector("style")!;
    expect(style.innerHTML).toContain("[data-chart=chart-x]");
    expect(style.innerHTML).toContain("--color-desktop: #3b82f6;");
    expect(el.className).not.toContain("recharts-cartesian");
  });

  it("tooltip renders label and explicit items", () => {
    const { getByText, container } = render(
      <ChartContainer id="t" config={config}>
        <ChartTooltipContent
          label="Jan"
          items={[{ label: "Desktop", value: "120", color: "#3b82f6" }]}
        />
      </ChartContainer>,
    );
    expect(getByText("Jan")).toBeTruthy();
    expect(getByText("120")).toBeTruthy();
    expect(container.querySelector('[data-slot="chart-tooltip"]')).toHaveClass(
      "border-border/50",
    );
  });

  it("legend derives a row per config entry", () => {
    const { getByText, container } = render(
      <ChartContainer id="l" config={config}>
        <ChartLegendContent />
      </ChartContainer>,
    );
    expect(
      container.querySelector('[data-slot="chart-legend"]'),
    ).toBeTruthy();
    expect(getByText("Desktop")).toBeTruthy();
  });
});
