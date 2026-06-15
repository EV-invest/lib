import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Calendar } from "../src/components/calendar";

describe("Calendar", () => {
  it("renders one month grid with the caption, weekday headers and day cells", () => {
    const { getByText, getAllByRole, container } = render(
      <Calendar defaultMonth={new Date(2026, 5, 1)} />,
    );
    expect(container.querySelector("[data-slot=calendar]")).toBeTruthy();
    expect(getByText("June 2026")).toBeTruthy();
    expect(getByText("Mo")).toBeTruthy();
    // June has 30 days.
    expect(getByText("30")).toBeTruthy();
    expect(getAllByRole("gridcell").length).toBe(30);
  });

  it("highlights the selected day and today (canon parity with Rust)", () => {
    const { getByText } = render(
      <Calendar
        defaultMonth={new Date(2026, 5, 1)}
        selected={new Date(2026, 5, 10)}
        today={new Date(2026, 5, 15)}
      />,
    );
    expect(getByText("10")).toHaveClass("bg-primary");
    expect(getByText("10")).toHaveAttribute("data-selected", "true");
    expect(getByText("15")).toHaveClass("bg-accent");
    expect(getByText("15")).toHaveAttribute("data-today", "true");
    expect(getByText("10").closest("td")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("fires onSelect with the clicked day", () => {
    const onSelect = vi.fn();
    const { getByText } = render(
      <Calendar defaultMonth={new Date(2026, 5, 1)} onSelect={onSelect} />,
    );
    fireEvent.click(getByText("12"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    const arg = onSelect.mock.calls[0]![0] as Date;
    expect(arg.getFullYear()).toBe(2026);
    expect(arg.getMonth()).toBe(5);
    expect(arg.getDate()).toBe(12);
  });

  it("navigates months and fires onMonthChange (week starts Monday)", () => {
    const onMonthChange = vi.fn();
    const { getByText, getByLabelText } = render(
      <Calendar
        defaultMonth={new Date(2026, 0, 1)}
        onMonthChange={onMonthChange}
      />,
    );
    expect(getByText("January 2026")).toBeTruthy();
    fireEvent.click(getByLabelText("Previous month"));
    expect(getByText("December 2025")).toBeTruthy();
    expect(onMonthChange).toHaveBeenCalledTimes(1);
    fireEvent.click(getByLabelText("Next month"));
    expect(getByText("January 2026")).toBeTruthy();
  });

  it("respects a controlled month prop (does not self-advance)", () => {
    const onMonthChange = vi.fn();
    const { getByText, getByLabelText } = render(
      <Calendar month={new Date(2026, 2, 1)} onMonthChange={onMonthChange} />,
    );
    expect(getByText("March 2026")).toBeTruthy();
    fireEvent.click(getByLabelText("Next month"));
    // Stays on March because the parent owns `month`; only the callback fires.
    expect(getByText("March 2026")).toBeTruthy();
    expect(onMonthChange).toHaveBeenCalledTimes(1);
  });
});
