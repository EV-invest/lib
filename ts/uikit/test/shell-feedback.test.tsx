import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { ResourceError } from "../src/components/resource-error";
import { Settled } from "../src/components/settled";
import { SystemBanner } from "../src/components/system-banner";

describe("ResourceError", () => {
  it("is one alerting line without a retry", () => {
    const { getByRole, queryByRole } = render(<ResourceError message="Couldn't load users" />);
    expect(getByRole("alert")).toHaveTextContent("Couldn't load users");
    expect(queryByRole("button")).toBeNull();
  });

  it("boxes the line with a retry button that reports its flight", () => {
    const onRetry = vi.fn();
    const { getByRole, rerender } = render(
      <ResourceError message="Couldn't load" onRetry={onRetry} labels={{ retry: "Повторить" }} />,
    );
    fireEvent.click(getByRole("button", { name: "Повторить" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(<ResourceError message="Couldn't load" onRetry={onRetry} retrying />);
    expect(getByRole("button", { name: "Try again" })).toBeDisabled();
  });

  it("renders the kit's Alert with a heading in the alert form", () => {
    const { container, getByText } = render(
      <ResourceError variant="alert" title="Couldn't load positions" message="The service did not answer." />,
    );
    expect(container.querySelector('[data-slot="alert"]')).toBeInTheDocument();
    expect(getByText("Couldn't load positions")).toHaveAttribute("data-slot", "alert-title");
  });
});

describe("SystemBanner", () => {
  it("draws a tone, a title and the message", () => {
    const { getByRole } = render(
      <SystemBanner tone="warn" title="Maintenance">
        Withdrawals are paused
      </SystemBanner>,
    );
    const strip = getByRole("status");
    expect(strip).toHaveAttribute("data-tone", "warn");
    expect(strip).toHaveTextContent("Maintenance — Withdrawals are paused");
  });

  it("shows a close button only with onDismiss, under an overridable name", () => {
    const onDismiss = vi.fn();
    const { getByRole, queryByRole, rerender } = render(<SystemBanner>Hello</SystemBanner>);
    expect(queryByRole("button")).toBeNull();
    rerender(<SystemBanner onDismiss={onDismiss} labels={{ dismiss: "Закрыть" }}>Hello</SystemBanner>);
    fireEvent.click(getByRole("button", { name: "Закрыть" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("Settled", () => {
  const state = (root: HTMLElement) => root.querySelector('[data-slot="settled"]')?.getAttribute("data-state");

  it("cuts straight in when no skeleton was shown", () => {
    const { container } = render(<Settled loading={false} skeleton="…">data</Settled>);
    expect(state(container)).toBe("ready");
  });

  it("reveals the content after a skeleton, and again after a refetch", () => {
    const { container, rerender } = render(<Settled loading skeleton="…">data</Settled>);
    expect(state(container)).toBe("loading");
    expect(container).toHaveTextContent("…");
    rerender(<Settled loading={false} skeleton="…">data</Settled>);
    expect(state(container)).toBe("revealed");
    const first = container.querySelector('[data-slot="settled"]');
    rerender(<Settled loading skeleton="…">data</Settled>);
    rerender(<Settled loading={false} skeleton="…">data</Settled>);
    // a fresh node, so the CSS entrance replays
    expect(container.querySelector('[data-slot="settled"]')).not.toBe(first);
    expect(state(container)).toBe("revealed");
  });
});
