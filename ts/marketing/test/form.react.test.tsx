import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { type Validated } from "../src/index";
import { TextField, useValidatedForm } from "../src/react/index";

type Lead = { name: string; phone: string };

const validate = (fields: Lead): Validated<Lead> => {
  const errors: Partial<Record<keyof Lead, string>> = {};
  if (fields.name.trim().length < 2) errors.name = "validation.name.min";
  if (!/^\+?\d{6,}$/.test(fields.phone)) errors.phone = "validation.phone.invalid";
  return Object.keys(errors).length
    ? { errors }
    : { data: { name: fields.name.trim(), phone: fields.phone } };
};

const initial: Lead = { name: "", phone: "" };

describe("useValidatedForm", () => {
  it("keeps failing fields as translation keys, not prose, and sends nothing", async () => {
    const send = vi.fn(async () => ({ data: {} }));
    const { result } = renderHook(() => useValidatedForm({ initial, validate, send }));
    await act(() => result.current.submit());
    expect(result.current.errors).toEqual({
      name: "validation.name.min",
      phone: "validation.phone.invalid",
    });
    expect(result.current.status).toBe("idle");
    expect(send).not.toHaveBeenCalled();
  });

  it("resolves keys through the injected t only in field()", async () => {
    const t = (key: string) => `T(${key})`;
    const { result } = renderHook(() =>
      useValidatedForm({ initial, validate, send: async () => ({}), t }),
    );
    await act(() => result.current.submit());
    expect(result.current.field("name").error).toBe("T(validation.name.min)");
    expect(result.current.errors.name).toBe("validation.name.min");
  });

  it("clears a field's error as soon as it is edited", async () => {
    const { result } = renderHook(() =>
      useValidatedForm({ initial, validate, send: async () => ({}) }),
    );
    await act(() => result.current.submit());
    act(() => result.current.edit("name")("Jo"));
    expect(result.current.errors).toEqual({ phone: "validation.phone.invalid" });
  });

  it("sends the cleaned payload and ends in sent", async () => {
    const send = vi.fn(async () => ({ data: { id: 1 } }));
    const { result } = renderHook(() =>
      useValidatedForm({ initial: { name: " Jo ", phone: "+33612345678" }, validate, send }),
    );
    await act(() => result.current.submit());
    expect(send).toHaveBeenCalledWith({ name: "Jo", phone: "+33612345678" });
    expect(result.current.status).toBe("sent");
  });

  it.each([
    ["an { error } pair", async () => ({ error: { message: "Bad" } }), "submit"],
    ["a non-ok Response", async () => ({ ok: false }), "submit"],
    [
      "a throw",
      async () => {
        throw new TypeError("Failed to fetch");
      },
      "network",
    ],
  ] as const)("reports %s as the %s failure key", async (_, send, failure) => {
    const { result } = renderHook(() =>
      useValidatedForm({ initial: { name: "Jo", phone: "+33612345678" }, validate, send }),
    );
    await act(() => result.current.submit());
    expect(result.current.status).toBe("error");
    expect(result.current.failure).toBe(failure);
  });
});

describe("TextField", () => {
  function Form() {
    const form = useValidatedForm({
      initial,
      validate,
      send: async () => ({}),
      t: key => (key === "validation.name.min" ? "Too short" : key),
    });
    return (
      <form onSubmit={form.submit} noValidate>
        <TextField label="Name" {...form.field("name")} />
        <button type="submit">Send</button>
      </form>
    );
  }

  it("announces the translated error for its control", async () => {
    render(<Form />);
    await act(async () => fireEvent.click(screen.getByText("Send")));
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Too short");
    expect(screen.getByRole("alert")).toHaveTextContent("Too short");
  });

  it("drops the error once the reader types", async () => {
    render(<Form />);
    await act(async () => fireEvent.click(screen.getByText("Send")));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Jo" } });
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
