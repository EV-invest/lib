// Builds `template/` as a brand would — against the packed tarballs of this
// package and the workspace kit and marketing layer — and holds the result to
// the contract a landing ships with: types, the brand's tests, `next build`,
// the bundle budget, and a live standalone server answering the routes.
//
// The unit tests exercise every factory on its own; only a real `next build`
// shows that the pieces meet Next where it is strict: segment config read
// statically, client boundaries, `server-only`, the proxy on the edge.
//
//   node scripts/check-template.mjs [--keep]
import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const kitstart = resolve(import.meta.dirname, "..");
const workspace = resolve(kitstart, "..");
const keep = process.argv.includes("--keep");
const dir = mkdtempSync(join(tmpdir(), "kitstart-template-"));
const packs = join(dir, ".packs");

const run = (cmd, args, cwd = dir, env = {}) => {
  console.log(`▶ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", ...env } });
};

/** `npm pack` into `.packs/`, answering the tarball's file name. */
function pack(pkg) {
  const out = execFileSync("npm", ["pack", "--json", "--pack-destination", packs], { cwd: join(workspace, pkg), encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  const report = JSON.parse(out.slice(out.lastIndexOf("\n[") + 1 || 0));
  return join(packs, report[0].filename);
}

async function freePort() {
  return new Promise(done => {
    const s = createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => done(port));
    });
  });
}

async function smoke() {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const server = spawn("node", [".next/standalone/server.js"], {
    cwd: dir,
    env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1", NODE_ENV: "production", LEADS_DB_PATH: join(dir, "data/leads.db") },
    stdio: ["ignore", "inherit", "inherit"],
  });
  try {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(`${base}/health`)).ok) break;
      } catch {
        // not up yet
      }
      await new Promise(r => setTimeout(r, 500));
    }
    const expect = async (what, path, init, want, check = () => true) => {
      const res = await fetch(`${base}${path}`, { redirect: "manual", ...init });
      const body = await res.text();
      const ok = res.status === want && check(res, body);
      console.log(`${ok ? "✓" : "✘"} ${res.status} ${what}`);
      if (!ok) throw new Error(`${what}: ${res.status} ${res.headers.get("location") ?? ""}\n${body.slice(0, 400)}`);
    };
    await expect("health", "/health", {}, 200);
    await expect("bare URL negotiates", "/", {}, 302, r => new URL(r.headers.get("location") ?? "", base).pathname === "/fr");
    await expect("the place's home, rewritten to its host-mode route", "/fr", {}, 200, (_, b) => b.includes('action="/quote"') && b.includes('href="/fr#quote"') && !b.includes("/_paris"));
    await expect("a page", "/en/prices", {}, 200, (_, b) => b.includes("FAQPage"));
    await expect("a cached page says so", "/fr", {}, 200, r => /s-maxage/.test(r.headers.get("cache-control") ?? ""));
    await expect("a dead path is the place's 404", "/fr/nope", {}, 404);
    await expect("noindex before launch", "/fr", {}, 200, (_, b) => /<meta name="robots" content="noindex/.test(b));
    await expect("robots disallow before launch", "/robots.txt", {}, 200, (_, b) => b.includes("Disallow: /"));
    const form = new URLSearchParams({ location: "paris", locale: "fr", form_id: "quote", t: String(Date.now() - 10_000), website: "", subject: "standard", locality: "75011", mobile: "0612345678" });
    await expect("the form posts without JavaScript", "/quote", { method: "POST", body: form }, 303, r => r.headers.get("location") === "/fr/thanks");
    // A suspected bot gets the same 303, so the redirect proves nothing: the row does.
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(join(dir, "data/leads.db"), { readOnly: true });
    const row = db.prepare("SELECT zip, location_id, spam_verdict FROM leads WHERE mobile = ?").get("0612345678");
    db.close();
    if (row?.zip !== "75011" || row?.location_id !== "paris" || row?.spam_verdict !== null) throw new Error(`the lead row is wrong: ${JSON.stringify(row)}`);
    console.log("✓ the lead is in the store, unflagged");
    await expect("the thank-you page", "/fr/thanks", {}, 200);
    await expect("the OG card", "/og?l=paris&lang=fr", {}, 200, r => r.headers.get("content-type") === "image/png");
  } finally {
    server.kill();
  }
}

try {
  cpSync(join(kitstart, "template"), dir, { recursive: true });
  mkdirSync(packs);
  const tarballs = { "@evinvest/uikit": pack("uikit"), "@evinvest/marketing": pack("marketing"), "@evinvest/kitstart": pack("kitstart") };
  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  for (const [name, file] of Object.entries(tarballs)) manifest.dependencies[name] = `file:${file}`;
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  // Until uikit 0.20 and marketing 0.3 are published, the workspace copies
  // carry the old version numbers and miss kitstart's peer ranges by name only.
  run("npm", ["install", "--legacy-peer-deps", "--no-audit", "--no-fund"]);
  run("npm", ["run", "typecheck"]);
  run("npm", ["test"]);
  run("npm", ["run", "build"]);
  run("npx", ["kitstart-size"]);
  await smoke();
  console.log(`template: ok (${dir})`);
} finally {
  if (!keep) rmSync(dir, { recursive: true, force: true });
}
