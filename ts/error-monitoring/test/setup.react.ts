// React's `act()` needs this flag set in a non-browser test environment so the
// jsdom suite renders without the "not configured to support act(...)" warning.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
