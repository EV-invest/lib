// Builds `template/` as a brand would — against the packed tarballs of this
// package and the workspace kit and marketing layer — and holds the result to
// the contract a landing ships with: types, the brand's tests, `next build`,
// the bundle budget, and a live standalone server answering the routes.
//
// The unit tests exercise every factory on its own; only a real `next build`
// shows that the pieces meet Next where it is strict: segment config read
// statically, client boundaries, `server-only`, the proxy on the edge.
//
//   node scripts/check-template.mjs [--keep] [--e2e] [--pre-publish | --registry]
//
// Default: the packed tarballs must satisfy the template's own ranges and
// kitstart's peers, exactly as a brand's install would demand, and npm installs
// with --strict-peer-deps (so does --registry).
// --pre-publish: before the first release the workspace packages carry their
//   old version numbers; the range checks are skipped (loudly) and npm is
//   told to ignore peers. Never the mode for a release.
// --e2e: then the template's own Playwright suite for the quote form
//   (`tests/e2e/quote-form.spec.ts`) against the standalone build — the form
//   posting without JavaScript and the kit's list with it. The runner is this
//   package's `@playwright/test`, linked into `tests/e2e` as a brand's flake
//   links its own; its browser must be installed (`npx playwright install
//   chromium`). The section screenshots stay a brand's: their baselines are
//   Linux captures the template does not carry.
// --registry: no tarballs — the template installs as it is, from npm; what a
//   brand gets after a release.
import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const kitstart = resolve(import.meta.dirname, "..");
const workspace = resolve(kitstart, "..");
const keep = process.argv.includes("--keep");
const prePublish = process.argv.includes("--pre-publish");
const registry = process.argv.includes("--registry");
const e2e = process.argv.includes("--e2e");

/** The slice of semver ranges these manifests use: `^x.y.z`, `>=`, `<`, AND by space, `||`, `*`. */
function satisfies(version, range) {
  const v = version.split(".").map(Number);
  const cmp = (a, b) => {
    for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
    return 0;
  };
  const one = term => {
    if (term === "*" || term === "") return true;
    const m = /^(\^|>=|<=|>|<|=)?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(term);
    if (!m) throw new Error(`unsupported range term ${term}`);
    const b = [Number(m[2]), Number(m[3] ?? 0), Number(m[4] ?? 0)];
    const c = cmp(v, b);
    switch (m[1]) {
      case "^": {
        if (c < 0) return false;
        const upper = b[0] > 0 ? [b[0] + 1, 0, 0] : b[1] > 0 ? [0, b[1] + 1, 0] : [0, 0, b[2] + 1];
        return cmp(v, upper) < 0;
      }
      case ">=": return c >= 0;
      case "<=": return c <= 0;
      case ">": return c > 0;
      case "<": return c < 0;
      default: return c === 0;
    }
  };
  return range.split("||").some(alt => alt.trim().split(/\s+/).every(one));
}

/** Every range the install will hold the packed versions to. */
function checkRanges(manifest, packed) {
  const kit = JSON.parse(readFileSync(join(kitstart, "package.json"), "utf8"));
  const problems = [];
  for (const [name, version] of Object.entries(packed)) {
    const wanted = manifest.dependencies[name];
    if (wanted && !satisfies(version, wanted)) problems.push(`template wants ${name}@${wanted}, packed ${version}`);
    const peer = kit.peerDependencies[name];
    if (peer && name !== "@evinvest/kitstart" && !satisfies(version, peer)) problems.push(`kitstart's peer ${name}@${peer}, packed ${version}`);
  }
  if (problems.length > 0) throw new Error(`the packed versions would not install as a brand's would:\n  ${problems.join("\n  ")}`);
}
const dir = mkdtempSync(join(tmpdir(), "kitstart-template-"));
const packs = join(dir, ".packs");

const run = (cmd, args, cwd = dir, env = {}) => {
  console.log(`▶ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", ...env } });
};

/** `npm pack` into `.packs/`, answering the tarball's path and version. */
function pack(pkg) {
  const out = execFileSync("npm", ["pack", "--json", "--pack-destination", packs], { cwd: join(workspace, pkg), encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  const report = JSON.parse(out.slice(out.lastIndexOf("\n[") + 1 || 0));
  return { file: join(packs, report[0].filename), version: report[0].version };
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
    env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1", NODE_ENV: "production", LEADS_DB_PATH: join(dir, "data/leads.db"), TRUSTED_PROXY: "xff:1" },
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
    // Rendered on the server by the global not-found page: the screen is in
    // the HTML, in the path's language, before any JavaScript.
    const gone = (_, b) => /<html lang="fr"/.test(b) && b.includes(">404<") && !b.includes("__next_error__");
    await expect("a dead path is the place's 404, rendered on the server", "/fr/nope", {}, 404, gone);
    await expect("junk without a language is a 404 too, in the negotiated language", "/wp-admin", { headers: { "accept-language": "en" } }, 404, (_, b) => /<html lang="en"/.test(b));
    // A 404 is per path and per language, and must never sit in a shared cache
    // as if it were a page.
    await expect("a 404 is not cached as a page", "/fr/nope", {}, 404, r => !/s-maxage|public/.test(r.headers.get("cache-control") ?? ""));
    // A scanner's file path is a dead path like any other: past the proxy it
    // would be Next's bare 404, cached, without the phone.
    const uncached = r => !/s-maxage|public/.test(r.headers.get("cache-control") ?? "");
    await expect("a file nobody serves is the place's 404", "/fr/x.php", {}, 404, (r, b) => gone(r, b) && uncached(r));
    await expect("a file without a language is a 404 too", "/wp-login.php", {}, 404, (r, b) => gone(r, b) && uncached(r));
    // Sent by hand to the 404 route, a gone header that names another
    // language or no real place is stripped: the brand's 404 in the path's
    // language answers, not the forged one.
    const forged = (header) => ({ headers: { "x-landing-not-found": header } });
    await expect("a forged gone header naming another language is dropped", "/fr/404/404", forged("en/_paris"), 404, (_, b) => /<html lang="fr"/.test(b) && b.includes(">404<"));
    await expect("a forged gone header naming no real place is dropped", "/fr/404/404", forged("fr/_nowhere"), 404, (_, b) => /<html lang="fr"/.test(b) && b.includes(">404<"));
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

async function quoteFormE2e() {
  const e2eDir = join(dir, "tests/e2e");
  mkdirSync(join(e2eDir, "node_modules/@playwright"), { recursive: true });
  for (const pkg of ["@playwright/test", "playwright", "playwright-core"]) {
    symlinkSync(join(kitstart, "node_modules", pkg), join(e2eDir, "node_modules", pkg), "dir");
  }
  run("npx", ["tsc", "--noEmit", "-p", "tests/e2e"]);
  const port = await freePort();
  run("node", [join(kitstart, "node_modules/@playwright/test/cli.js"), "test", "quote-form.spec.ts", "--reporter=line"], e2eDir, { E2E_PORT: String(port) });
}

try {
  cpSync(join(kitstart, "template"), dir, { recursive: true });
  // Strict peers: a peer range that no longer meets the kit or Next fails the
  // install here, not as a warning a brand scrolls past.
  const install = ["install", "--no-audit", "--no-fund", ...(prePublish ? [] : ["--strict-peer-deps"])];
  if (!registry) {
    mkdirSync(packs);
    const tarballs = { "@evinvest/uikit": pack("uikit"), "@evinvest/marketing": pack("marketing"), "@evinvest/kitstart": pack("kitstart") };
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const versions = Object.fromEntries(Object.entries(tarballs).map(([n, t]) => [n, t.version]));
    if (prePublish) {
      console.warn("\n!!! --pre-publish: packed versions are NOT checked against the template's ranges or kitstart's peers,");
      console.warn(`!!! and npm ignores peers. Packed: ${JSON.stringify(versions)}. Never release on this run.\n`);
      install.push("--legacy-peer-deps");
    } else {
      checkRanges(manifest, versions);
    }
    for (const [name, t] of Object.entries(tarballs)) manifest.dependencies[name] = `file:${t.file}`;
    writeFileSync(join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  run("npm", install);
  run("npm", ["run", "lint"]);
  run("npm", ["run", "typecheck"]);
  run("npm", ["test"]);
  run("npm", ["run", "build"]);
  run("npx", ["kitstart-size"]);
  await smoke();
  if (e2e) await quoteFormE2e();
  console.log(`template: ok (${dir})`);
} finally {
  if (!keep) rmSync(dir, { recursive: true, force: true });
}
