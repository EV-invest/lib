import { act, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CountUp, Reveal, Settle, SplitText, Stagger, StaggerItem } from "../src/react/index";

// A controllable `prefers-reduced-motion` query. motion reads it once per
// module graph and then follows `change` events — which is also how the test
// reproduces the real sequence: the server renders not knowing the
// preference (false), and the browser that hydrates already has it (true).
// Own file because vitest isolates that module state per file.
let reduced = false;
const listeners = new Set<() => void>();
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      get matches() {
        return /prefers-reduced-motion/.test(query) && reduced;
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      dispatchEvent: () => false,
    }),
  });
});

function setReduced(value: boolean) {
  reduced = value;
  listeners.forEach(fn => fn());
}

let container: HTMLDivElement | undefined;
afterEach(() => {
  container?.remove();
  setReduced(false);
});

function Page() {
  return (
    <main>
      <h1>
        <SplitText>
          Fix it <span>today</span>
        </SplitText>
      </h1>
      <Settle>cta</Settle>
      <Reveal onMount data-testid="reveal">
        block
      </Reveal>
      <Stagger onMount>
        <StaggerItem>card</StaggerItem>
      </Stagger>
      <CountUp value={42} locale="fr-FR" />
    </main>
  );
}

describe("prefers-reduced-motion from the OS", () => {
  it("hydrates server markup rendered without the preference, with no mismatch", async () => {
    const html = renderToString(<Page />);
    setReduced(true);

    container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const root = await act(async () =>
      hydrateRoot(container!, <Page />, { onRecoverableError }),
    );

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(
      consoleError.mock.calls.filter(args => /hydrat/i.test(String(args[0]))),
    ).toEqual([]);
    consoleError.mockRestore();

    // And the preference still wins on the client: the block fades in place.
    await act(() => new Promise(r => setTimeout(r, 120)));
    expect(screen.getByTestId("reveal").style.transform).not.toMatch(
      /translate[XY]\((?!0px\))/,
    );
    act(() => root.unmount());
  });
});
