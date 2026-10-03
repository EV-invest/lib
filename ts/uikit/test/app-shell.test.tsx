import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { AppShell } from "../src/components/app-shell";
import { MobileAppBar } from "../src/components/mobile-app-bar";
import { PageFrame, PageHeading, SectionLabel } from "../src/components/page-frame";

const slot = (root: HTMLElement, name: string) => root.querySelector(`[data-slot="${name}"]`);

describe("AppShell", () => {
  it("places the slots and swaps rail for tab bar at the breakpoint", () => {
    const { container, getByRole } = render(
      <AppShell rail={<aside>rail</aside>} tabBar={<nav aria-label="tabs" />} banner={<p>down for maintenance</p>}>
        <h1>Page</h1>
      </AppShell>,
    );
    expect(slot(container, "app-shell-rail")).toHaveClass("hidden", "lg:flex", "sticky");
    expect(slot(container, "app-shell-tab-bar")).toHaveClass("fixed", "lg:hidden");
    expect(slot(container, "app-shell-content")?.className).toContain("lg:pb-0");
    expect(slot(container, "app-shell-banner")).toHaveTextContent("down for maintenance");
    expect(getByRole("main")).toHaveTextContent("Page");
  });

  it("takes `md` as the breakpoint", () => {
    const { container } = render(<AppShell breakpoint="md" rail="r" tabBar="t" />);
    expect(slot(container, "app-shell-rail")).toHaveClass("md:flex");
    expect(slot(container, "app-shell-tab-bar")).toHaveClass("md:hidden");
  });

  it("renders no wrapper, and reserves no room, for an empty slot", () => {
    const { container } = render(<AppShell rail={false} tabBar={null}>x</AppShell>);
    expect(slot(container, "app-shell-rail")).toBeNull();
    expect(slot(container, "app-shell-tab-bar")).toBeNull();
    expect(slot(container, "app-shell-banner")).toBeNull();
    expect(slot(container, "app-shell-content")?.className).not.toContain("pb-");
  });

  it("forwards mainProps to <main>", () => {
    const { getByRole } = render(<AppShell mainProps={{ id: "content" }}>x</AppShell>);
    expect(getByRole("main")).toHaveAttribute("id", "content");
  });
});

describe("PageFrame", () => {
  it("staggers its sections in by CSS, the heading first", () => {
    const { container } = render(
      <PageFrame title="Wallet" description="Your balance" eyebrow="Fund" actions={<button type="button">Deposit</button>}>
        <section>one</section>
        <section>two</section>
      </PageFrame>,
    );
    const frame = slot(container, "page-frame") as HTMLElement;
    expect(frame).toHaveAttribute("data-enter", "stagger");
    expect(frame.style.getPropertyValue("--enter-step")).toBe("var(--ev-stagger-section, 50ms)");
    expect(frame.firstElementChild).toHaveAttribute("data-slot", "page-heading");
    expect(frame.children).toHaveLength(3);
  });

  it("hands the phone's title to the app bar and starts a step behind it", () => {
    const { container, getAllByRole } = render(
      <PageFrame title="Wallet" appBar={<MobileAppBar title="Wallet" />}>
        <section>one</section>
      </PageFrame>,
    );
    const frame = slot(container, "page-frame") as HTMLElement;
    expect(slot(container, "page-heading")).toHaveClass("hidden", "lg:flex");
    expect(frame.style.getPropertyValue("--enter-delay")).toBe("var(--ev-stagger-section, 50ms)");
    expect(getAllByRole("heading", { level: 1 })).toHaveLength(2);
  });

  it("caps a `content` frame at a reading measure", () => {
    const { container } = render(<PageFrame width="content">x</PageFrame>);
    expect(slot(container, "page-frame")).toHaveClass("max-w-5xl");
    expect(slot(container, "page-heading")).toBeNull();
  });
});

describe("PageHeading / SectionLabel", () => {
  it("renders only the parts given", () => {
    const { container, getByRole } = render(<PageHeading title="Users" />);
    expect(getByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
    expect(container.querySelector("p")).toBeNull();
  });

  it("labels in two tones, on any element", () => {
    const { container } = render(<SectionLabel as="h2" tone="accent">Portfolio</SectionLabel>);
    expect(container.querySelector("h2")).toHaveClass("text-primary-ink", "uppercase");
  });
});

describe("MobileAppBar", () => {
  it("is a root bar without `back`: title flush left, no spacer", () => {
    const { container, getByRole } = render(<MobileAppBar title="Settings" right={<button type="button">Edit</button>} />);
    expect(getByRole("heading", { name: "Settings" })).toHaveClass("text-lg");
    expect(container.querySelector("header")).toHaveClass("lg:hidden");
    expect(container.querySelector("header")).toHaveAttribute("data-enter", "rise");
  });

  it("routes a back href through linkComponent with an overridable label", () => {
    const Link = (props: React.ComponentProps<"a">) => <a data-fake-link="" {...props} />;
    const { getByRole } = render(
      <MobileAppBar title="Security" back={{ href: "/settings" }} linkComponent={Link} labels={{ back: "Назад" }} />,
    );
    const back = getByRole("link", { name: "Назад" });
    expect(back).toHaveAttribute("href", "/settings");
    expect(back).toHaveAttribute("data-fake-link");
    expect(getByRole("heading", { name: "Security" })).toHaveClass("text-center");
  });

  it("renders a back button for `onClick`", () => {
    const onClick = vi.fn();
    const { getByRole } = render(<MobileAppBar title="Step 2" back={{ onClick }} hideFrom={false} />);
    fireEvent.click(getByRole("button", { name: "Back" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
