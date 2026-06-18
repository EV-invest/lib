// jsdom setup for the React test project. Tells React it is running inside an
// `act()`-aware environment, so `act(...)` flushes effects without warnings.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

export {};
