import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// On the server — no `window` — FormSelect's scripted list is fetched as the
// kit's module loads, so a render finds it here; the page itself always gets
// the native select, written whole.

const asked = vi.hoisted(() => ({ list: false }));
vi.mock("../src/react/FormSelectKit", async (original: () => Promise<unknown>) => ((asked.list = true), original()));

const OPTIONS = [
  { value: "leak", label: "Fuite" },
  { value: "boiler", label: "Chaudière" },
];

describe("FormSelect on the server", () => {
  it("asks for its list's chunk as the kit's module loads, before anything renders", async () => {
    expect(typeof window).toBe("undefined");
    await import("../src/react/index");
    await vi.waitFor(() => expect(asked.list).toBe(true));
  });

  it("renders the native select in one synchronous pass, with no Suspense boundary", async () => {
    const { FormSelect, loadLazyParts } = await import("../src/react/index");
    // The fetch the module load started: nothing new is asked for here.
    await loadLazyParts();
    const html = renderToString(
      <form>
        <FormSelect name="job" options={OPTIONS} defaultValue="boiler" />
      </form>,
    );
    expect(html).toMatch(/<select[^>]* name="job"/);
    expect(html).not.toContain('role="combobox"');
    // `<!--$-->` opens a Suspense boundary in React's server markup.
    expect(html).not.toContain("<!--$");
  });
});
