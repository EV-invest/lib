// Dry run for the first release of @evinvest/i18n.
//
// Releases go through `nix run .#publish -- <major|minor|patch>` (AGENTS.md), and
// that script bumps the version BEFORE `npm publish`. So a publish that dies
// halfway costs a version number and, on a bad day, leaves the manifest claiming
// a version that never reached the registry. Everything checkable is therefore
// checked here first, without publishing anything.
//
//   node scripts/preflight.mjs        # from ts/i18n
//
// Auth checks are skipped rather than failed when NPM_TOKEN is absent, so this is
// useful on a laptop that holds no release token.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

let failed = 0;
let warned = 0;

const ok = m => console.log(`  ok    ${m}`);
const warn = m => (warned++, console.log(`  warn  ${m}`));
const bad = m => (failed++, console.log(`  FAIL  ${m}`));
const step = m => console.log(`\n${m}`);

function run(cmd, args, opts = {}) {
  try {
    return { out: execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }) };
  } catch (e) {
    return { err: e, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

step("discovery — will `nix run .#publish` see this package?");
// publish.rs walks ts/*, skips `private: true`, and treats "no <name>-v* tag" as
// never published. Mirror those three conditions exactly.
if (path.basename(path.dirname(path.resolve("package.json"))) && existsSync("package.json")) {
  ok(`ts/${path.basename(process.cwd())}/package.json exists`);
} else {
  bad("package.json not found — run this from ts/i18n");
}
if (pkg.private === true) bad('"private": true — publish.rs skips it'); else ok("not private");

const tag = run("git", ["describe", "--tags", "--abbrev=0", "--match", `${pkg.name}-v*`], { cwd: root });
if (tag.err) ok(`no ${pkg.name}-v* tag — treated as never published, so it will be released`);
else warn(`already tagged ${tag.out.trim()} — this would be a re-release, not a first release`);

step("version");
// The publish script bumps before publishing, so the number that reaches npm is
// this one bumped by the level given. 0.0.0 + minor = 0.1.0, the intended first release.
if (pkg.version === "0.0.0") ok("0.0.0 — `-- minor` publishes 0.1.0");
else warn(`${pkg.version} — \`-- minor\` would publish ${pkg.version.replace(/^(\d+)\.(\d+)\..*/, (_, a, b) => `${a}.${+b + 1}.0`)}, skipping ${pkg.version}`);

step("registry");
const view = run("npm", ["view", `${pkg.name}`, "version"]);
if (view.err) ok(`${pkg.name} is unpublished — the name is free`);
else warn(`${pkg.name}@${view.out.trim()} already exists — publish must bump past it`);

step("manifest promises");
for (const [sub, map] of Object.entries(pkg.exports ?? {})) {
  for (const [cond, target] of Object.entries(map)) {
    if (existsSync(target)) ok(`${sub} ${cond} -> ${target}`);
    else bad(`${sub} ${cond} -> ${target} (missing — run npm run build)`);
  }
}
if (pkg.publishConfig?.access === "public") ok("publishConfig.access = public");
else bad("publishConfig.access must be public for a scoped package");
if (pkg.repository?.directory) ok(`repository.directory = ${pkg.repository.directory}`);
else warn("no repository.directory — npm cannot deep-link the source");

step("build + tests");
for (const [label, args] of [["typecheck", ["run", "typecheck"]], ["test", ["run", "test"]], ["build", ["run", "build"]]]) {
  const r = run("npm", args);
  if (r.err) bad(`npm ${args.join(" ")} failed:\n${r.out.split("\n").slice(-12).join("\n")}`);
  else ok(label);
}

step("tarball");
const packed = run("node", ["scripts/verify-pack.mjs"]);
if (packed.err) bad(`verify-pack rejected the tarball:\n${packed.out}`);
else ok(packed.out.trim().replace(/^verify-pack:\s*/, ""));

step("npm auth");
if (!process.env.NPM_TOKEN) {
  warn("NPM_TOKEN unset — skipping auth checks (the release host needs it)");
} else {
  const npmrc = path.join(root, "scripts/publish.npmrc");
  const who = run("npm", ["whoami"], { env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrc } });
  if (who.err) bad("NPM_TOKEN is set but the registry rejects it");
  else {
    ok(`authenticated as ${who.out.trim()}`);
    // The documented trap (publish.rs): a 404 on publish means authenticated but
    // NOT authorised, and npm hides the difference. A granular token lists the
    // packages it may write — and a package that does not exist yet cannot be on
    // that list, so a granular token often cannot create the first version.
    const access = run("npm", ["access", "list", "packages", "@evinvest"], { env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrc } });
    if (access.err) warn("could not list @evinvest package permissions — verify the token may CREATE new packages");
    else if (access.out.includes(pkg.name)) ok(`token lists ${pkg.name}`);
    else warn(`token does not list ${pkg.name} — expected for a new package, but a GRANULAR token then cannot create it. Use an automation/classic token with @evinvest write access for this first release.`);
  }
}

step("worktree");
const dirty = run("git", ["status", "--porcelain", "--", "."], { cwd: process.cwd() });
if (dirty.out.trim()) warn(`uncommitted changes here — publish.rs commits and tags:\n${dirty.out.trimEnd()}`);
else ok("clean");

console.log(
  failed === 0
    ? `\n${warned === 0 ? "ready" : `ready (${warned} warning${warned === 1 ? "" : "s"})`} — release with:\n\n    cd ${root} && NPM_TOKEN=… nix run .#publish -- minor\n`
    : `\n${failed} blocking problem(s) — not ready to publish\n`,
);
process.exit(failed === 0 ? 0 : 1);
