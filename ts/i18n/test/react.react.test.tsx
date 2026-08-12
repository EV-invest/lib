import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider, useLocale, useT } from "../src/react/index";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const MESSAGES = {
  "hero.title": "Invest in the China+1 narrative",
  "roles.count": "{n, plural, one {# вакансия} few {# вакансии} many {# вакансий}}",
};

function Probe() {
  const t = useT();
  const locale = useLocale();
  return (
    <span data-testid="out">
      {locale}:{t("hero.title")}:{t("roles.count", { n: 3 })}
    </span>
  );
}

describe("I18nProvider", () => {
  it("supplies locale and a bound translate function", () => {
    act(() => {
      root.render(
        <I18nProvider locale="ru" messages={MESSAGES}>
          <Probe />
        </I18nProvider>,
      );
    });
    expect(container.textContent).toBe(
      "ru:Invest in the China+1 narrative:3 вакансии",
    );
  });

  it("reports missing keys through onMissing and renders the key", () => {
    const onMissing = vi.fn();
    function Missing() {
      return <span>{useT()("nope.key")}</span>;
    }
    act(() => {
      root.render(
        <I18nProvider locale="en" messages={MESSAGES} onMissing={onMissing}>
          <Missing />
        </I18nProvider>,
      );
    });
    expect(container.textContent).toBe("nope.key");
    expect(onMissing).toHaveBeenCalledWith("nope.key", "en");
  });
});

describe("hooks without a provider", () => {
  it("throw a message pointing at the Server Component path", () => {
    // A missing provider means the locale itself is unknown — there is nothing
    // to degrade to, so this must fail loudly rather than render one locale
    // inside another.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      act(() => {
        root.render(<Probe />);
      });
    }).toThrow(/requires an <I18nProvider>/);
    spy.mockRestore();
  });
});
