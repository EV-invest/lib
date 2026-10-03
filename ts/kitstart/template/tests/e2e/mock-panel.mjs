// The panel's internal endpoints as the e2e suite needs them, on
// `E2E_MOCK_PORT`: the place's live half (nothing over the baked place), and
// a price list that is down — so the page prices from the baked model.
import { createServer } from "node:http";

const port = Number(process.env["E2E_MOCK_PORT"]);
const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://mock");
  if (url.pathname === "/health") return json(res, 200, { ok: true });
  if (url.pathname === "/pricing") return json(res, 503, { error: "down" });
  if (url.pathname === "/locations/paris") {
    return json(res, 200, {});
  }
  return json(res, 404, { error: "no such route" });
}).listen(port, "127.0.0.1");
