import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LEAD_CAPTURE_TEXT } from "../src/index";
import { serviceAreaPlace } from "../src/testing/index";

// On the server — no `window` — every lazily drawn part is fetched as its
// module loads, so a render finds it here and writes it into the page whole.

const asked = vi.hoisted(() => new Set<string>());
vi.mock("../src/react/LeadCaptureSteps", async (original: () => Promise<unknown>) => (asked.add("steps"), original()));
vi.mock("../src/react/LeadCaptureEstimate", async (original: () => Promise<unknown>) => (asked.add("estimate"), original()));
vi.mock("../src/react/LeadCapturePrice", async (original: () => Promise<unknown>) => (asked.add("price"), original()));
vi.mock("../src/react/FormSelectKit", async (original: () => Promise<unknown>) => (asked.add("form-select-kit"), original()));

describe("the kit's lazily drawn parts on the server", () => {
  it("are asked for as the kit's module loads, before anything renders", async () => {
    expect(typeof window).toBe("undefined");
    await import("../src/react/index");
    await vi.waitFor(() => expect([...asked].sort()).toEqual(["estimate", "form-select-kit", "price", "steps"]));
  });

  it("render in one synchronous pass, the steps written whole with no Suspense boundary", async () => {
    const { LeadCapture, loadLazyParts } = await import("../src/react/index");
    // The fetches the module load started: nothing new is asked for here.
    await loadLazyParts();
    const html = renderToString(
      <LeadCapture
        place={serviceAreaPlace(["fr", "en"])}
        contact={{ phone: "+33 6 12 34 56 78", whatsapp: null }}
        locale="fr"
        renderedAt={1_800_000_000_000}
        wire={{ subject: "job", locality: "zip", mobile: "mobile" }}
        needs={[{ value: "leak", label: "Fuite d’eau" }]}
        text={LEAD_CAPTURE_TEXT.fr}
        layout="steps"
      />,
    );
    expect(html).toContain('data-lead-step="need"');
    expect(html).toContain('data-lead-step="phone"');
    // `<!--$-->` opens a Suspense boundary in React's server markup.
    expect(html).not.toContain("<!--$");
  });
});
