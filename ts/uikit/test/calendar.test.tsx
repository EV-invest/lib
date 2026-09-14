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
    expect(getByText("15")).toHaveClass("bg-hover");
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

describe("Calendar bounds and locale", () => {
  it("disables days outside [min, max] and never fires onSelect for them", () => {
    const onSelect = vi.fn();
    const { getByText, container } = render(
      <Calendar
        defaultMonth={new Date(2026, 5, 1)}
        min={new Date(2026, 5, 10, 9, 30)}
        max={new Date(2026, 5, 20, 18, 0)}
        onSelect={onSelect}
      />,
    );
    // 9 days before `min` + 10 days after `max`.
    expect(container.querySelectorAll("[data-disabled=true]").length).toBe(19);
    expect(getByText("9")).toBeDisabled();
    expect(getByText("21")).toBeDisabled();
    // Day granularity: the day at `min` stays enabled even though the time is later.
    expect(getByText("10")).not.toBeDisabled();
    expect(getByText("10")).not.toHaveAttribute("data-disabled");
    fireEvent.click(getByText("9"));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(getByText("10"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders no data-disabled attribute at all when unbounded", () => {
    const { container } = render(<Calendar defaultMonth={new Date(2026, 5, 1)} />);
    expect(container.querySelector("[data-disabled]")).toBeNull();
    expect(container.querySelectorAll("button:disabled").length).toBe(0);
  });

  it("takes custom nav labels", () => {
    const { getByLabelText } = render(
      <Calendar
        defaultMonth={new Date(2026, 5, 1)}
        previousMonthLabel="Предыдущий месяц"
        nextMonthLabel="Следующий месяц"
      />,
    );
    expect(getByLabelText("Предыдущий месяц")).toBeTruthy();
    expect(getByLabelText("Следующий месяц")).toBeTruthy();
  });

  it("localises the caption and weekday headers through Intl (Monday-first)", () => {
    const { container, queryByText } = render(
      <Calendar defaultMonth={new Date(2026, 5, 1)} locale="ru" />,
    );
    const caption = container.querySelector("[data-slot=calendar] > div > div")!;
    expect(caption.textContent).toContain("2026");
    expect(caption.textContent!.toLowerCase()).toContain("июн");
    expect(queryByText("June 2026")).toBeNull();
    const headers = Array.from(container.querySelectorAll("th")).map(
      th => th.textContent!.toLowerCase(),
    );
    expect(headers.length).toBe(7);
    expect(headers[0]).toContain("пн");
    expect(headers[6]).toContain("вс");
  });
});
