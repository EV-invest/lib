import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { DateTimePicker } from "../src/components/date-time-picker";

const june = (day: number, hour = 0, minute = 0) => new Date(2026, 5, day, hour, minute);
const TODAY = june(15, 12, 0);

const slot = (root: HTMLElement, name: string) =>
  root.ownerDocument.querySelector<HTMLElement>(`[data-slot=date-time-picker-${name}]`);
const trigger = (root: HTMLElement) => slot(root, "trigger")!;
const lastArg = (fn: ReturnType<typeof vi.fn>): Date | null =>
  fn.mock.calls[fn.mock.calls.length - 1]![0] as Date | null;

describe("DateTimePicker", () => {
  it("renders the placeholder trigger with data-placeholder and an empty hidden input while closed", () => {
    const { container } = render(
      <DateTimePicker placeholder="Pick a moment" name="starts_at" today={TODAY} />,
    );
    expect(container.querySelector("[data-slot=date-time-picker]")).toBeTruthy();
    const btn = trigger(container);
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("type", "button");
    expect(btn).toHaveAttribute("data-placeholder", "true");
    expect(btn).toHaveAttribute("aria-haspopup", "dialog");
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveTextContent("Pick a moment");
    expect(btn.querySelector("svg")).toHaveAttribute("aria-hidden");
    const hidden = container.querySelector<HTMLInputElement>("input[type=hidden]")!;
    expect(hidden).toHaveAttribute("name", "starts_at");
    expect(hidden.value).toBe("");
    expect(document.querySelector("[data-slot=calendar]")).toBeNull();
    expect(slot(container, "hours")).toBeNull();
  });

  it("opens on click and shows the calendar plus zero-padded time inputs", () => {
    const { container, getByRole } = render(
      <DateTimePicker value={june(10, 9, 5)} name="starts_at" today={TODAY} />,
    );
    const btn = trigger(container);
    expect(btn).not.toHaveAttribute("data-placeholder");
    expect(btn).toHaveTextContent("2026-06-10 09:05");
    expect(container.querySelector<HTMLInputElement>("input[type=hidden]")!.value).toBe(
      String(Math.floor(june(10, 9, 5).getTime() / 1000)),
    );
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(slot(container, "content")).toHaveClass("w-auto", "p-0");
    expect(slot(container, "content")).toHaveAttribute("role", "dialog");
    expect(getByRole("dialog", { name: "Choose date and time" })).toBe(slot(container, "content"));
    expect(document.querySelector("[data-slot=calendar]")).toBeTruthy();
    expect(document.querySelector("[data-selected=true]")).toHaveTextContent("10");
    const hours = slot(container, "hours") as HTMLInputElement;
    const minutes = slot(container, "minutes") as HTMLInputElement;
    expect(hours.value).toBe("09");
    expect(minutes.value).toBe("05");
    expect(hours).toHaveAttribute("inputmode", "numeric");
    expect(hours).toHaveAttribute("aria-label", "Hours");
    expect(minutes).toHaveAttribute("aria-label", "Minutes");
    expect(slot(container, "time")).toBeTruthy();
    expect(slot(container, "clear")).toHaveTextContent("Clear");
  });

  it("moves focus into the hours field on open and back to the trigger on close", () => {
    const { container } = render(<DateTimePicker value={june(10, 9, 5)} today={TODAY} />);
    const btn = trigger(container);
    btn.focus();
    fireEvent.click(btn);
    expect(document.activeElement).toBe(slot(container, "hours"));
    fireEvent.click(slot(container, "clear")!);
    expect(document.activeElement).toBe(btn);
  });

  it("closes when focus tabs out of the popover and hands it back to the trigger", () => {
    const { container } = render(<DateTimePicker value={june(10, 9, 5)} today={TODAY} />);
    const btn = trigger(container);
    btn.focus();
    fireEvent.click(btn);
    const clear = slot(container, "clear")!;
    clear.focus();
    // Moving between the dialog's own controls keeps it open.
    fireEvent.blur(clear, { relatedTarget: slot(container, "minutes") });
    expect(btn).toHaveAttribute("aria-expanded", "true");
    // The window losing focus is not the operator leaving.
    fireEvent.blur(clear, { relatedTarget: null });
    expect(btn).toHaveAttribute("aria-expanded", "true");
    fireEvent.blur(clear, { relatedTarget: document.body });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(btn);
  });

  it("selects the whole field on focus, so typing replaces rather than appends", () => {
    const { container } = render(<DateTimePicker value={june(10, 9, 5)} defaultOpen today={TODAY} />);
    const hours = slot(container, "hours") as HTMLInputElement;
    hours.focus();
    expect(hours.selectionStart).toBe(0);
    expect(hours.selectionEnd).toBe(2);
  });

  it("keeps the time on a day click and leaves the popover open", () => {
    const onChange = vi.fn();
    const { container, getByText } = render(
      <DateTimePicker value={june(10, 9, 5)} onChange={onChange} today={TODAY} />,
    );
    fireEvent.click(trigger(container));
    fireEvent.click(getByText("12"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(lastArg(onChange)!.getTime()).toBe(june(12, 9, 5).getTime());
    expect(trigger(container)).toHaveAttribute("aria-expanded", "true");
  });

  it("lands a typed time on `today` while empty and zeroes the seconds", () => {
    const onChange = vi.fn();
    const { container } = render(
      <DateTimePicker onChange={onChange} today={new Date(2026, 5, 15, 12, 30, 45, 500)} />,
    );
    fireEvent.click(trigger(container));
    fireEvent.change(slot(container, "hours")!, { target: { value: "14" } });
    expect(lastArg(onChange)!.getTime()).toBe(june(15, 14, 0).getTime());
    fireEvent.change(slot(container, "minutes")!, { target: { value: "7" } });
    // Uncontrolled: the hours just typed stick.
    expect(lastArg(onChange)!.getTime()).toBe(june(15, 14, 7).getTime());
    // Sequential typing over the controlled field: "1", then the browser hands
    // over "01" + "5" — the last two digits win.
    fireEvent.change(slot(container, "hours")!, { target: { value: "1" } });
    expect(lastArg(onChange)!.getHours()).toBe(1);
    fireEvent.change(slot(container, "hours")!, { target: { value: "015" } });
    expect(lastArg(onChange)!.getHours()).toBe(15);
    // Overflow clamps to the field's range; empty input keeps the last value.
    fireEvent.change(slot(container, "hours")!, { target: { value: "31" } });
    expect(lastArg(onChange)!.getHours()).toBe(23);
    const calls = onChange.mock.calls.length;
    fireEvent.change(slot(container, "hours")!, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledTimes(calls);
  });

  it("clamps the result into [min, max] at minute precision", () => {
    const onChange = vi.fn();
    const { container, getByText } = render(
      <DateTimePicker
        value={june(15, 8, 0)}
        min={june(10, 9, 30)}
        max={june(20, 18, 0)}
        onChange={onChange}
        today={TODAY}
      />,
    );
    fireEvent.click(trigger(container));
    // 10 June at 08:00 is before `min` → snaps to `min`.
    fireEvent.click(getByText("10"));
    expect(lastArg(onChange)!.getTime()).toBe(june(10, 9, 30).getTime());
    fireEvent.change(slot(container, "hours")!, { target: { value: "23" } });
    expect(lastArg(onChange)!.getTime()).toBe(june(15, 23, 0).getTime());
  });

  it("never fires onChange for a day outside [min, max]", () => {
    const onChange = vi.fn();
    const { container, getByText } = render(
      <DateTimePicker
        value={june(15, 12, 0)}
        min={june(10, 9, 0)}
        max={june(20, 18, 0)}
        onChange={onChange}
        today={TODAY}
      />,
    );
    fireEvent.click(trigger(container));
    expect(document.querySelectorAll("[data-disabled=true]").length).toBe(19);
    expect(getByText("9")).toBeDisabled();
    fireEvent.click(getByText("9"));
    fireEvent.click(getByText("21"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears to null and closes the popover", () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    const { container } = render(
      <DateTimePicker
        defaultValue={june(10, 9, 5)}
        onChange={onChange}
        onOpenChange={onOpenChange}
        today={TODAY}
      />,
    );
    fireEvent.click(trigger(container));
    fireEvent.click(slot(container, "clear")!);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(trigger(container)).toHaveAttribute("data-placeholder", "true");
    expect(trigger(container)).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on the close button without touching the value", () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    const { container, getByLabelText } = render(
      <DateTimePicker
        defaultValue={june(10, 9, 5)}
        onChange={onChange}
        onOpenChange={onOpenChange}
        today={TODAY}
      />,
    );
    fireEvent.click(trigger(container));
    const close = slot(container, "close")!;
    expect(getByLabelText("Close")).toBe(close);
    expect(close).toHaveAttribute("type", "button");
    fireEvent.click(close);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger(container)).toHaveTextContent("2026-06-10 09:05");
    expect(trigger(container)).toHaveAttribute("aria-expanded", "false");
  });

  it("lets `format` drive the trigger label", () => {
    const { container } = render(
      <DateTimePicker
        value={june(10, 9, 5)}
        format={v => `${v.getDate()}/${v.getMonth() + 1} at ${v.getHours()}h`}
        locale="ru"
        today={TODAY}
      />,
    );
    expect(trigger(container)).toHaveTextContent("10/6 at 9h");
  });

  it("formats the label and the calendar through Intl when `locale` is set", () => {
    const { container } = render(
      <DateTimePicker value={june(10, 9, 5)} locale="ru" today={TODAY} />,
    );
    const text = trigger(container).textContent!.toLowerCase();
    expect(text).toContain("2026");
    expect(text).toContain("июн");
    expect(text).toContain("09:05");
    fireEvent.click(trigger(container));
    const caption = document.querySelector("[data-slot=calendar-caption]")!;
    expect(caption.textContent!.toLowerCase()).toContain("июн");
  });

  it("keeps the Intl label on the 24-hour clock in a 12-hour locale", () => {
    const { container } = render(
      <DateTimePicker value={june(10, 14, 5)} locale="en-US" today={TODAY} />,
    );
    const text = trigger(container).textContent!;
    expect(text).toContain("14:05");
    expect(text).not.toMatch(/PM/i);
    fireEvent.click(trigger(container));
    expect((slot(container, "hours") as HTMLInputElement).value).toBe("14");
  });

  it("re-renders a controlled value and the time inputs", () => {
    const { container, rerender } = render(
      <DateTimePicker value={june(10, 9, 5)} defaultOpen today={TODAY} />,
    );
    expect(trigger(container)).toHaveTextContent("2026-06-10 09:05");
    rerender(<DateTimePicker value={june(11, 18, 30)} defaultOpen today={TODAY} />);
    expect(trigger(container)).toHaveTextContent("2026-06-11 18:30");
    expect((slot(container, "hours") as HTMLInputElement).value).toBe("18");
    expect((slot(container, "minutes") as HTMLInputElement).value).toBe("30");
    rerender(<DateTimePicker value={null} placeholder="Empty" defaultOpen today={TODAY} />);
    expect(trigger(container)).toHaveTextContent("Empty");
    expect(trigger(container)).toHaveAttribute("data-placeholder", "true");
    expect((slot(container, "hours") as HTMLInputElement).value).toBe("00");
  });

  it("puts labels, id, disabled and aria-* where they belong", () => {
    const { container, getByLabelText, getByRole, getByText } = render(
      <DateTimePicker
        id="starts"
        disabled
        defaultOpen
        aria-invalid
        aria-describedby="starts-hint"
        labels={{
          previousMonth: "Назад",
          nextMonth: "Вперёд",
          hours: "Часы",
          minutes: "Минуты",
          clear: "Сбросить",
          dialog: "Выбор даты и времени",
          close: "Закрыть",
        }}
        today={TODAY}
      />,
    );
    const btn = trigger(container);
    expect(btn).toHaveAttribute("id", "starts");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-invalid", "true");
    expect(btn).toHaveAttribute("aria-describedby", "starts-hint");
    expect(btn).toHaveClass("w-full", "justify-start");
    expect(getByRole("dialog", { name: "Выбор даты и времени" })).toBe(slot(container, "content"));
    expect(getByLabelText("Назад")).toBeTruthy();
    expect(getByLabelText("Вперёд")).toBeTruthy();
    expect(getByLabelText("Назад")).toBeDisabled();
    expect(getByText("12")).toBeDisabled();
    expect(getByText("12")).toHaveAttribute("data-disabled", "true");
    expect(getByLabelText("Часы")).toBeDisabled();
    expect(getByLabelText("Минуты")).toBeDisabled();
    expect(slot(container, "clear")).toBeDisabled();
    expect(slot(container, "clear")).toHaveTextContent("Сбросить");
    expect(getByLabelText("Закрыть")).toBe(slot(container, "close"));
    expect(slot(container, "close")).toBeDisabled();
  });
});
