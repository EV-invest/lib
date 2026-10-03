// Its own file: React warns about a missing key once per parent element name
// for the life of the module, so a warning set off by another suite would hide
// the one this file looks for.
import { act, fireEvent, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEAD_CAPTURE_TEXT } from "../src/index";
import { LeadCapture } from "../src/react/index";
import { serviceAreaPlace } from "../src/testing/index";

/**
 * An element as the RSC client hands it to a client component: built on the
 * server, it may arrive as a lazy reference resolved only when React renders
 * it, never seen by the JSX that placed it, so React cannot vouch for its key.
 * A brand's slot built in a server component and passed to `LeadCapture`
 * arrives so.
 */
function fromServer(element: ReactElement): ReactNode {
  const node = { $$typeof: Symbol.for("react.lazy"), _payload: element, _init: (el: ReactElement) => el, _store: { validated: 0 } };
  // The lazy node is React's own wire shape, not a type it exports.
  return node as unknown as ReactNode;
}

const keyWarnings = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.filter(([msg]) => typeof msg === "string" && msg.includes('unique "key"'));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("LeadCapture's slots", () => {
  it("are the brand's elements as they are, with no key asked of them", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // The check itself: such an element, bare in a list, is warned about.
    render(<section>{[<p key="a">a</p>, fromServer(<p>b</p>)]}</section>);
    expect(keyWarnings(spy)).toHaveLength(1);
    spy.mockClear();

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true, location: "/fr/paris/thanks" })));
    render(
      <LeadCapture
        place={serviceAreaPlace(["fr"])}
        contact={{ phone: "+33 6 12 34 56 78", whatsapp: null }}
        locale="fr"
        renderedAt={Date.now()}
        wire={{ subject: "job", locality: "zip", mobile: "mobile" }}
        needs={[{ value: "leak", label: "Fuite" }]}
        need="leak"
        text={LEAD_CAPTURE_TEXT.fr}
        // Shaped as aquafix's QuoteForm (LEAD-FORMS-RETEST-2026-10-03 N3):
        // a heading block, and a fragment of lines with a conditional one.
        head={fromServer(
          <div>
            <p>Devis</p>
            <p>Gratuit</p>
          </div>,
        )}
        extras={fromServer(<input name="rooms" aria-label="Pièces" />)}
        trust={fromServer(
          <>
            {false && <p>Prix indicatif</p>}
            <p>4,9 sur Google</p>
            <div />
          </>,
        )}
        done={fromServer(<p>Merci</p>)}
      />,
    );
    const form = document.getElementById("quote-form") as HTMLFormElement;
    fireEvent.change(form.querySelector("input[name=zip]") as HTMLInputElement, { target: { value: "75011" } });
    fireEvent.change(form.querySelector("input[name=mobile]") as HTMLInputElement, { target: { value: "06 12 34 56 78" } });
    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });
    expect(document.body).toHaveTextContent("Merci");
    expect(keyWarnings(spy)).toEqual([]);
  });
});
