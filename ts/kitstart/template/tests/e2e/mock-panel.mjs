// The panel's internal endpoints as the e2e suite needs them, on
// `E2E_MOCK_PORT`: the place's live half — in French the panel set the
// place's booking to a Cal.com event; in English nothing over the baked place,
// whose booking is a call (`manual`) — and a price list that is down, so the page prices from the baked model,
// until a test serves one (`POST /_e2e/pricing`): the panel changing the
// tariff under an open page.
import { createServer } from "node:http";

const port = Number(process.env["E2E_MOCK_PORT"]);
const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

let pricing = null;

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://mock");
  if (url.pathname === "/health") return json(res, 200, { ok: true });
  if (url.pathname === "/_e2e/pricing" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      pricing = JSON.parse(body);
      json(res, 200, { ok: true });
    });
    return;
  }
  if (url.pathname === "/pricing") return pricing ? json(res, 200, pricing) : json(res, 503, { error: "down" });
  if (url.pathname === "/locations/paris") {
    return json(res, 200, url.searchParams.get("locale") === "fr" ? { booking: { provider: "cal_com", url: "https://cal.com/brand/menage" } } : {});
  }
  return json(res, 404, { error: "no such route" });
}).listen(port, "127.0.0.1");
