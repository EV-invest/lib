import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// React 18/19 require this flag for `act(...)` to drive updates in tests.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// jsdom ships neither; motion's `whileInView` / `useInView` construct an
// observer on mount. Nothing here asserts on scroll triggering — the reveals
// under test use `onMount`, and the stub only keeps the scroll path mountable.
class NoopIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: readonly number[] = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
Object.defineProperty(globalThis, "IntersectionObserver", {
  configurable: true,
  writable: true,
  value: NoopIntersectionObserver,
});

afterEach(() => cleanup());
