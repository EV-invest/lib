import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "../src/components/input-otp";

function Basic(props: {
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <InputOTP maxLength={4} {...props}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
      </InputOTPGroup>
    </InputOTP>
  );
}

describe("InputOTP", () => {
  it("renders the hidden input, groups, slots and separator", () => {
    const { container } = render(<Basic />);
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).toHaveAttribute("maxlength", "4");
    expect(
      container.querySelectorAll('[data-slot="input-otp-group"]'),
    ).toHaveLength(2);
    expect(
      container.querySelectorAll('[data-slot="input-otp-slot"]'),
    ).toHaveLength(4);
    expect(
      container.querySelector('[data-slot="input-otp-separator"]'),
    ).toHaveAttribute("role", "separator");
  });

  it("shows typed characters in the slots (uncontrolled)", () => {
    const { container } = render(<Basic defaultValue="12" />);
    const slots = container.querySelectorAll('[data-slot="input-otp-slot"]');
    expect(slots[0]!.textContent).toContain("1");
    expect(slots[1]!.textContent).toContain("2");
    expect(slots[2]!.textContent).toBe("");
  });

  it("routes typing through onChange and caps at maxLength", () => {
    const seen: string[] = [];
    const { container } = render(<Basic onChange={(v) => seen.push(v)} />);
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "123456" } });
    expect(seen).toEqual(["1234"]);
  });

  it("marks the active slot on focus", () => {
    const { container } = render(<Basic defaultValue="1" />);
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.focus(input);
    const slots = container.querySelectorAll('[data-slot="input-otp-slot"]');
    expect(slots[1]).toHaveAttribute("data-active", "true");
  });

  it("reflects a controlled value", () => {
    const { container } = render(<Basic value="99" />);
    const slots = container.querySelectorAll('[data-slot="input-otp-slot"]');
    expect(slots[0]!.textContent).toContain("9");
    expect(slots[1]!.textContent).toContain("9");
  });
});
