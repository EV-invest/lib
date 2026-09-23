// The shape `next build` + the landing's `postbuild` leave behind, and nothing
// more: a standalone server, its static chunks, the fonts the OG route reads,
// and the route bundle stats the size gate measures.
import { mkdirSync, writeFileSync } from "node:fs";

const chunk = "self.__chunk=" + JSON.stringify("x".repeat(4096)) + ";";
mkdirSync(".next/standalone/.next/static/chunks", { recursive: true });
mkdirSync(".next/standalone/assets/fonts", { recursive: true });
mkdirSync(".next/static/chunks", { recursive: true });
mkdirSync(".next/diagnostics", { recursive: true });
writeFileSync(".next/standalone/server.js", 'require("node:http").createServer((_, res) => res.end("ok")).listen(process.env.PORT);\n');
writeFileSync(".next/standalone/assets/fonts/Display.ttf", "font");
writeFileSync(".next/static/chunks/a.js", chunk);
writeFileSync(".next/standalone/.next/static/chunks/a.js", chunk);
writeFileSync(
  ".next/diagnostics/route-bundle-stats.json",
  JSON.stringify([{ route: "/[locale]/[location]", firstLoadChunkPaths: [".next/static/chunks/a.js"] }]),
);
