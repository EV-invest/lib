import { beforeAll } from "vitest";

// LeadCapture's pieces and FormSelect's scripted list come from chunks of
// their own; a test renders a card and reads it at once, so every chunk is
// here first. The chunks not yet here are `*.cold.test.tsx`'s. Imported in
// the hook, not at the top: by then the test file's `vi.mock`s are
// registered, and a static import here would load the kit (and
// `next/navigation.js` under AnalyticsBoundary) before them.
beforeAll(async () => {
  const { loadLazyParts } = await import("../src/react/index");
  await loadLazyParts();
});
