// The browser half of `field.rsc.test.tsx`, run in its own Node process: the
// RSC project resolves `react` to its server build, and hydration needs the
// client one. Takes a Flight payload in `FLIGHT_PAYLOAD`, renders it to HTML
// the way SSR does, hydrates that HTML in jsdom, and prints what the DOM ended up with.
//
// `__webpack_require__` stands in for the bundler: each client reference in the
// payload resolves to the kit module itself, as it would in a Next app.
import { Readable } from "node:stream";
import { JSDOM } from "jsdom";
import { createFromNodeStream } from "react-server-dom-webpack/client.node";

const modules: Record<string, unknown> = {
  field: await import("../../src/components/field"),
  input: await import("../../src/components/input"),
  checkbox: await import("../../src/components/checkbox"),
};
Object.assign(globalThis, {
  __webpack_require__: (id: string) => modules[id],
  __webpack_chunk_load__: () => Promise.resolve(),
});

const moduleMap = Object.fromEntries(Object.keys(modules).map(id => [id, { "*": { id, chunks: [], name: "*" } }]));

// Through the environment, not stdin: once stdin ends, vite-node lets the
// process exit while a later dynamic `import()` is still pending.
const payload = process.env["FLIGHT_PAYLOAD"];
if (payload === undefined) throw new Error("FLIGHT_PAYLOAD is not set");

const tree = () => createFromNodeStream(Readable.from([Buffer.from(payload)]), { moduleMap, serverModuleMap: null, moduleLoading: null });

const { renderToString } = await import("react-dom/server");
const React = await import("react");
const Root = ({ model }: { model: Promise<React.ReactNode> }) => React.use(model);
// `renderToString` cannot wait on the payload; resolve it first, as SSR's
// streaming render would.
const ssrModel = tree();
await ssrModel;
const html = renderToString(<Root model={ssrModel} />);

const dom = new JSDOM(`<!doctype html><html><body><div id="root">${html}</div></body></html>`);
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const { hydrateRoot } = await import("react-dom/client");
const container = dom.window.document.getElementById("root")!;
const recoverable: string[] = [];
const clientModel = tree();
await clientModel;
await React.act(async () => {
  hydrateRoot(container, <Root model={clientModel} />, {
    onRecoverableError: error => void recoverable.push(String((error as Error).message)),
  });
});

const label = container.querySelector("label");
const control = container.querySelector("input, button");
process.stdout.write(
  JSON.stringify({
    labelFor: label?.getAttribute("for") ?? null,
    controlId: control?.getAttribute("id") ?? null,
    labelText: label?.textContent ?? null,
    recoverable,
  }),
);
