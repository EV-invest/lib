import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createLocaleRegistry } from "../src/index";
import { I18nProvider as DefaultProvider, createI18nReact } from "../src/react/index";

const fr = createLocaleRegistry({
  locales: ["fr", "en"],
  labels: { fr: "Français", en: "English" },
  default: "fr",
  prefixDefaultLocale: true,
});
const { I18nProvider, useLocale, useT } = createI18nReact(fr);

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

function Probe() {
  const locale = useLocale();
  return <span>{`${locale}:${useT()("cta", "Appelez-nous")}`}</span>;
}

describe("createI18nReact", () => {
  it("serves the call-site copy for the registry's default locale", () => {
    act(() => {
      root.render(
        <I18nProvider locale="fr" messages={{ cta: "IGNORED" }}>
          <Probe />
        </I18nProvider>,
      );
    });
    expect(container.textContent).toBe("fr:Appelez-nous");
  });

  it("translates the other locales from the catalogue", () => {
    act(() => {
      root.render(
        <I18nProvider locale="en" messages={{ cta: "Call us" }}>
          <Probe />
        </I18nProvider>,
      );
    });
    expect(container.textContent).toBe("en:Call us");
  });

  it("owns its own context — the default provider does not feed these hooks", () => {
    expect(() => {
      act(() => {
        root.render(
          <DefaultProvider locale="en" messages={{}}>
            <Probe />
          </DefaultProvider>,
        );
      });
    }).toThrow(/locales \[fr, en\], default "fr"\).*registry\.translator\(\)/);
  });
});
