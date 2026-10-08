import { beforeAll } from "vitest";

// FormSelect's scripted list (`FormSelectKit`) comes from a chunk of its own;
// a test renders a form and reads the kit's Select at once, so the chunk is
// here first. The chunk not yet here is `*.cold.test.tsx`'s. Imported in
// the hook, not at the top: by then the test file's `vi.mock`s are
// registered, and a static import here would load the kit (and
// `next/navigation.js` under AnalyticsBoundary) before them.
beforeAll(async () => {
  const { loadLazyParts } = await import("../src/react/index");
  await loadLazyParts();
});
