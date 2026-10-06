import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AbSwitcherProps } from "../src/react/index";

const props: AbSwitcherProps = { experiments: [{ key: "lead_form", variants: [{ value: "a", label: "A" }] }], qaCookie: "ab__qa" };
const clearCookies = () => {
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
};

/**
 * A fresh gate whose panel module is a stand-in counting its own loads: the
 * mock factory runs only when the gate imports the panel. Mocked per test, as
 * a factory's result outlives `vi.resetModules`.
 */
async function freshGate() {
  const loaded = vi.fn();
  vi.resetModules();
  vi.doMock("../src/react/AbSwitcherPanel", () => {
    loaded();
    return { AbSwitcherPanel: (p: AbSwitcherProps) => <div data-testid="panel">{p.qaCookie}</div> };
  });
  const { AbSwitcher } = await import("../src/react/AbSwitcher");
  return { AbSwitcher, loaded };
}

describe("AbSwitcher", () => {
  beforeEach(clearCookies);
  afterEach(() => {
    vi.doUnmock("../src/react/AbSwitcherPanel");
    vi.unstubAllEnvs();
    clearCookies();
  });

  it("in production, without the QA cookie, renders nothing and never imports the panel", async () => {
    vi.stubEnv("NODE_ENV", "production");
    document.cookie = "ab_lead_form=b; path=/";
    const { AbSwitcher, loaded } = await freshGate();
    const { container } = render(<AbSwitcher {...props} />);
    // The effect has run once render returns; any import it started is settled here.
    await vi.dynamicImportSettled();
    expect(container).toBeEmptyDOMElement();
    expect(loaded).not.toHaveBeenCalled();
  });

  it("in production, with the QA cookie, imports the panel and renders it", async () => {
    vi.stubEnv("NODE_ENV", "production");
    document.cookie = "ab__qa=1; path=/";
    const { AbSwitcher, loaded } = await freshGate();
    render(<AbSwitcher {...props} />);
    expect(await screen.findByTestId("panel")).toHaveTextContent("ab__qa");
    expect(loaded).toHaveBeenCalledOnce();
  });

  it("outside production, shows without the cookie", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { AbSwitcher, loaded } = await freshGate();
    render(<AbSwitcher {...props} />);
    expect(await screen.findByTestId("panel")).toBeInTheDocument();
    expect(loaded).toHaveBeenCalledOnce();
  });
});

describe("AbSwitcherPanel", () => {
  const experiments = [
    { key: "lead_form", label: "Lead form", variants: [{ value: "a", label: "Compact" }, { value: "b", label: "Steps" }] },
    { key: "hero", variants: [{ value: "a", label: "Plain" }, { value: "b", label: "Photo" }] },
  ];
  const href = "https://x.test/fr?ab_lead_form=a&utm_source=x#quote";
  let nav: { href: string; assign: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    clearCookies();
    nav = { href, assign: vi.fn(), replace: vi.fn() };
    vi.stubGlobal("location", nav);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    clearCookies();
  });

  const chip = () => screen.getByRole("button", { name: "A/B test switcher" });

  it("shows the assignments from the cookies on the chip, and the current variant pressed", async () => {
    document.cookie = "ab_lead_form=b; path=/";
    document.cookie = "ab__qa=1; path=/";
    const { AbSwitcherPanel } = await import("../src/react/AbSwitcherPanel");
    const { container } = render(<AbSwitcherPanel experiments={experiments} qaCookie="ab__qa" />);
    expect(container.firstElementChild).toHaveAttribute("data-ab-switcher");
    expect(chip()).toHaveTextContent("A/Bb–");
    fireEvent.click(chip());
    const panel = screen.getByRole("dialog", { name: "A/B test switcher" });
    expect(within(panel).getByRole("button", { name: "Steps" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByRole("button", { name: "Compact" })).toHaveAttribute("aria-pressed", "false");
    expect(within(panel).getByRole("group", { name: "hero" })).toHaveTextContent("not running");
  });

  it("shows an experiment no cookie assigns as off: its variants disabled, the assigned one's live", async () => {
    document.cookie = "ab_lead_form=a; path=/";
    const { AbSwitcherPanel } = await import("../src/react/AbSwitcherPanel");
    render(<AbSwitcherPanel experiments={experiments} qaCookie="ab__qa" />);
    expect(chip()).toHaveTextContent("A/Ba–");
    fireEvent.click(chip());
    const hero = screen.getByRole("group", { name: "hero" });
    expect(hero).toHaveTextContent("not running");
    for (const name of ["Plain", "Photo"]) expect(within(hero).getByRole("button", { name })).toBeDisabled();
    fireEvent.click(within(hero).getByRole("button", { name: "Photo" }));
    expect(nav.assign).not.toHaveBeenCalled();
    const form = screen.getByRole("group", { name: "Lead form" });
    expect(form).not.toHaveTextContent("not running");
    for (const name of ["Compact", "Steps"]) expect(within(form).getByRole("button", { name })).toBeEnabled();
    expect(within(form).getByRole("button", { name: "Compact" })).toHaveFocus();
  });

  it("shows a test the proxy lists in <qaCookie>_off as not running, though its assignment cookie stays", async () => {
    document.cookie = "ab_lead_form=b; path=/";
    document.cookie = "ab_hero=a; path=/";
    document.cookie = "ab__qa_off=lead_form; path=/";
    const { AbSwitcherPanel } = await import("../src/react/AbSwitcherPanel");
    render(<AbSwitcherPanel experiments={experiments} qaCookie="ab__qa" />);
    expect(chip()).toHaveTextContent("A/B–a");
    fireEvent.click(chip());
    const form = screen.getByRole("group", { name: "Lead form" });
    expect(form).toHaveTextContent("not running");
    expect(within(form).getByRole("button", { name: "Steps" })).toBeDisabled();
    expect(within(screen.getByRole("group", { name: "hero" })).getByRole("button", { name: "Photo" })).toBeEnabled();
  });

  it("takes the assignments from current when given, disabling only what it leaves out", async () => {
    document.cookie = "ab_hero=b; path=/";
    const { AbSwitcherPanel } = await import("../src/react/AbSwitcherPanel");
    render(<AbSwitcherPanel experiments={experiments} qaCookie="ab__qa" current={{ lead_form: "b" }} text={{ unassigned: "à l’arrêt" }} />);
    fireEvent.click(chip());
    expect(screen.getByRole("button", { name: "Steps" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Photo" })).toBeDisabled();
    expect(screen.getByRole("group", { name: "hero" })).toHaveTextContent("à l’arrêt");
  });

  it("forces a variant through the brand's parameter, keeping the page's own", async () => {
    const { AbSwitcherPanel } = await import("../src/react/AbSwitcherPanel");
    render(<AbSwitcherPanel experiments={experiments} qaCookie="ab__qa" current={{ lead_form: "a" }} />);
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole("button", { name: "Steps" }));
    expect(nav.assign).toHaveBeenCalledWith("https://x.test/fr?ab_lead_form=b&utm_source=x#quote");
  });

  it("resets the assignments and keeps the QA cookie; leaving the test drops it too", async () => {
    document.cookie = "ab_lead_form=b; path=/";
    document.cookie = "ab_hero=a; path=/";
    document.cookie = "ab__qa=1; path=/";
    const { AbSwitcherPanel } = await import("../src/react/AbSwitcherPanel");
    render(<AbSwitcherPanel experiments={experiments} qaCookie="ab__qa" />);
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(document.cookie).toBe("ab__qa=1");
    expect(nav.replace).toHaveBeenCalledWith("https://x.test/fr?utm_source=x");
    fireEvent.click(screen.getByRole("button", { name: "Leave test" }));
    expect(document.cookie).toBe("");
  });

  it("closes on Escape with the focus back on the chip; minimizes and hides in memory", async () => {
    const { AbSwitcherPanel } = await import("../src/react/AbSwitcherPanel");
    const { container } = render(<AbSwitcherPanel experiments={experiments} qaCookie="ab__qa" text={{ hide: "Masquer" }} />);
    fireEvent.click(chip());
    // No cookie assigns either experiment: nothing to pick, so the reset takes the focus.
    expect(screen.getByRole("button", { name: "Reset" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(chip()).toHaveFocus();
    fireEvent.click(chip());
    fireEvent.pointerDown(screen.getByRole("button", { name: "Compact" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
    expect(chip()).toHaveTextContent(/^A\/B$/);
    fireEvent.click(chip());
    expect(chip()).toHaveTextContent("A/B––");
    fireEvent.click(screen.getByRole("button", { name: "Masquer" }));
    expect(container).toBeEmptyDOMElement();
  });
});
