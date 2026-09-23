// The shape `next build` + the landing's `postbuild` leave behind, and a
// server that keeps the contract `container-smoke` holds a landing image to:
// /health, the bare URL's 302, a page, the OG card, a form POST whose lead
// lands in the data mount — and a 500 everywhere without its prod env.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

// The vendored dependency installed from its override, not the registry.
if (createRequire(import.meta.url)("fixture-vendored") !== "vendored") throw new Error("fixture-vendored missing");
const chunk = "self.__chunk=" + JSON.stringify("x".repeat(4096)) + ";";
mkdirSync(".next/standalone/.next/static/chunks", { recursive: true });
mkdirSync(".next/standalone/assets/fonts", { recursive: true });
mkdirSync(".next/static/chunks", { recursive: true });
mkdirSync(".next/diagnostics", { recursive: true });

writeFileSync(
  ".next/standalone/server.js",
  `const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const db = process.env.LEADS_DB_PATH;
http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (!db) return res.writeHead(500).end("LEADS_DB_PATH is required in production");
    if (url.pathname === "/health") return res.writeHead(200).end("ok");
    if (url.pathname === "/") return res.writeHead(302, { Location: "/fr" }).end();
    if (url.pathname === "/og") return res.writeHead(200, { "Content-Type": "image/png" }).end();
    if (url.pathname === "/quote" && req.method === "POST") {
      let body = "";
      req.on("data", c => (body += c));
      req.on("end", () => {
        fs.mkdirSync(path.dirname(db), { recursive: true });
        fs.appendFileSync(db, body + "\\n");
        res.writeHead(303, { Location: "/fr/thanks" }).end();
      });
      return;
    }
    if (url.pathname.startsWith("/fr")) return res.writeHead(200, { "Content-Type": "text/html" }).end("<!doctype html><html lang=fr></html>");
    res.writeHead(404).end();
  })
  .listen(Number(process.env.PORT), process.env.HOSTNAME || "0.0.0.0");
`,
);
writeFileSync(".next/standalone/assets/fonts/Display.ttf", "font");
writeFileSync(".next/static/chunks/a.js", chunk);
writeFileSync(".next/standalone/.next/static/chunks/a.js", chunk);
writeFileSync(
  ".next/diagnostics/route-bundle-stats.json",
  JSON.stringify([{ route: "/[locale]/[location]", firstLoadChunkPaths: [".next/static/chunks/a.js"] }]),
);
