import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { collect, messageSlices, runSlices, serialiseSlices, type TableRule } from "../src/extract/index";

// A miniature App Router app: a layout with a client nav, a client error
// boundary, a wallet page reaching client leaves three ways (a client
// component, a plain module it imports, an `import()`), and a table of tips
// two pages pick rows out of. Each test works on its own copy, so a test that
// breaks the app breaks nothing else.
const FIXTURE = fileURLToPath(new URL("./fixtures/slices-app", import.meta.url));
const WALLET = "app/[locale]/wallet/page.tsx";
const INVEST = "app/[locale]/invest/page.tsx";
const TIPS: TableRule = {
  table: "tips/copy.ts",
  keys: ["tips.*.title", "tips.*.body"],
  ignore: ["tips/catalog.ts"],
};

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "i18n-slices-"));
  cpSync(FIXTURE, root, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const write = (path: string, text: string) => writeFileSync(join(root, path), text);

describe("messageSlices on a clean app", () => {
  it("puts the keys of layouts and boundary files in the shell", () => {
    const { slices, errors } = messageSlices({ root, tables: [TIPS] });

    expect(errors).toEqual([]);
    expect(slices.shell).toEqual(["err.title", "nav.home"]);
  });

  it("gives a page the keys of its client tree, minus the shell", () => {
    const { slices } = messageSlices({ root, tables: [TIPS] });

    // panel.k: a "use client" component the server page renders.
    // helper.k: a module with no directive, client because panel imports it.
    // lazy.k: reached through `import("./lazy")`.
    // tips.wallet.x.*: the row the page names with anchor="wallet.x".
    expect(slices.routes[WALLET]).toEqual([
      "helper.k",
      "lazy.k",
      "panel.k",
      "tips.a11y.about",
      "tips.wallet.x.body",
      "tips.wallet.x.title",
    ]);
  });

  it("selects only the table rows whose id a page names", () => {
    const { slices } = messageSlices({ root, tables: [TIPS] });

    expect(slices.routes[INVEST]).toEqual(["tips.a11y.about", "tips.invest.y.body", "tips.invest.y.title"]);
    expect(slices.routes[WALLET]).not.toContain("tips.invest.y.title");
  });

  it("does not follow an import type into a client file", () => {
    const { slices } = messageSlices({ root, tables: [TIPS] });

    expect(slices.routes[WALLET]).not.toContain("typeonly.k");
    expect(slices.serverOnly).toContain("typeonly.k");
  });

  it("files server t() calls and unimported files under serverOnly", () => {
    const { slices } = messageSlices({ root, tables: [TIPS] });

    expect(slices.serverOnly).toEqual(["meta.title", "orphan.k", "typeonly.k", "wallet.server"]);
  });

  it("treats a \"use client\" after a leading comment as a boundary", () => {
    // nav.tsx opens with a block comment; were the directive missed, nav.home
    // would fall to serverOnly and render English in every locale.
    const { slices } = messageSlices({ root, tables: [TIPS] });

    expect(slices.shell).toContain("nav.home");
    expect(slices.serverOnly).not.toContain("nav.home");
  });

  it("does not treat a \"use client\" after an import as a boundary", () => {
    write(
      "shell/nav.tsx",
      'import { useT } from "@evinvest/i18n/react";\n"use client";\nexport function Nav() {\n  const t = useT();\n  return t("nav.home", "Home");\n}\n',
    );

    const { slices } = messageSlices({ root, tables: [TIPS] });

    expect(slices.shell).toEqual(["err.title"]);
    expect(slices.serverOnly).toContain("nav.home");
  });

  it("carries every row of a table that has no rule", () => {
    const { slices, errors } = messageSlices({ root });

    expect(errors).toEqual([]);
    expect(slices.routes[INVEST]).toEqual([
      "tips.a11y.about",
      "tips.invest.y.body",
      "tips.invest.y.title",
      "tips.wallet.x.body",
      "tips.wallet.x.title",
    ]);
  });

  it("accounts for every key collect reads, in exactly one of shell, routes or serverOnly", () => {
    const { slices } = messageSlices({ root, tables: [TIPS] });
    const everyKey = collect({ root }).entries.map(e => e.key).sort();

    const routed = Object.values(slices.routes).flat();
    const carried = [...slices.shell, ...routed];

    expect([...new Set([...carried, ...slices.serverOnly])].sort()).toEqual(everyKey);
    expect(slices.serverOnly.filter(key => carried.includes(key))).toEqual([]);
    expect(routed.filter(key => slices.shell.includes(key))).toEqual([]);
  });
});

// `collect` and the slice generator read call sites through one shared module
// (extract/calls.ts); these pin what `collect` gives on the same app.
describe("collect", () => {
  it("reads every t() call under the root, with its English and location", () => {
    const { entries, errors } = collect({ root });

    expect(errors).toEqual([]);
    expect(entries.map(e => e.key).sort()).toEqual([
      "err.title",
      "helper.k",
      "lazy.k",
      "meta.title",
      "nav.home",
      "orphan.k",
      "panel.k",
      "tips.a11y.about",
      "tips.invest.y.body",
      "tips.invest.y.title",
      "tips.wallet.x.body",
      "tips.wallet.x.title",
      "typeonly.k",
      "wallet.server",
    ]);
    expect(entries.find(e => e.key === "nav.home")).toEqual({
      key: "nav.home",
      en: "Home",
      where: "shell/nav.tsx:8",
    });
  });

  it("reports a computed key and a key defined twice with different English", () => {
    write("scripts/bad.ts", 'const k = "x";\nt(k, "X");\nt("nav.home", "Start");\n');

    const { errors } = collect({ root });

    // Which of the two sites is "first" follows directory order, which the
    // filesystem decides; the message names both either way.
    expect(errors).toHaveLength(2);
    expect(errors).toContain("scripts/bad.ts:2: t() key is not a string literal");
    expect(errors).toContainEqual(expect.stringMatching(/"nav\.home" is also defined at .* with different English/));
    expect(errors.join("\n")).toMatch(/shell\/nav\.tsx:8[\s\S]*scripts\/bad\.ts:3|scripts\/bad\.ts:3[\s\S]*shell\/nav\.tsx:8/);
  });

  it("reports the same unreadable call sites as the slice generator", () => {
    write("scripts/bad.ts", 'const k = "x";\nt(k, "X");\nt("no.english");\n');

    expect(messageSlices({ root, tables: [TIPS] }).errors).toEqual(collect({ root }).errors);
  });
});

describe("messageSlices on what the graph cannot account for", () => {
  it("reports a path alias that resolves to no file", () => {
    write(INVEST, 'import { Gone } from "@/components/gone";\nexport default () => <Gone />;\n');

    const { errors } = messageSlices({ root, tables: [TIPS] });

    expect(errors).toEqual([
      `${INVEST}:1: cannot resolve "@/components/gone" — a local import the graph cannot follow`,
    ]);
  });

  it("reports a relative import that resolves to no file", () => {
    write(INVEST, 'import { Gone } from "./gone";\nexport default () => <Gone />;\n');

    const { errors } = messageSlices({ root, tables: [TIPS] });

    expect(errors).toEqual([`${INVEST}:1: cannot resolve "./gone" — a local import the graph cannot follow`]);
  });

  it("reports an import() of a computed path", () => {
    write("components/dynamic.ts", 'const path = "./lazy";\nexport const load = () => import(path);\n');

    const { errors } = messageSlices({ root, tables: [TIPS] });

    expect(errors).toEqual(["components/dynamic.ts:2: import() of a non-literal path cannot be followed"]);
  });

  it("reports a table rule whose templates match none of the table's keys", () => {
    const { errors } = messageSlices({ root, tables: [{ table: "tips/copy.ts", keys: ["hints.*.title"] }] });

    expect(errors).toEqual(["table rule for tips/copy.ts: none of its t() keys matches hints.*.title"]);
  });

  it("throws on a key template without a star", () => {
    expect(() => messageSlices({ root, tables: [{ table: "tips/copy.ts", keys: ["tips.title"] }] })).toThrow(
      'key template "tips.title" needs exactly one "*"',
    );
  });

  it("throws on a key template with two stars", () => {
    expect(() => messageSlices({ root, tables: [{ table: "tips/copy.ts", keys: ["tips.*.*"] }] })).toThrow(
      'key template "tips.*.*" needs exactly one "*"',
    );
  });
});

describe("runSlices", () => {
  const OUT = () => join(root, "i18n-slices.json");
  const CONFIG = () => join(root, "slices.config.json");

  /** `process.exit` as a throw, so a failing run stops where the bin would. */
  const exits = () =>
    vi.spyOn(process, "exit").mockImplementation((code?: string | number | null) => {
      throw new Error(`exit ${code}`);
    });

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("writes the slices with the generated header", () => {
    runSlices(["--root", root, "--config", CONFIG()]);

    const written = JSON.parse(readFileSync(OUT(), "utf8")) as Record<string, unknown>;
    expect(written["//"]).toMatch(/^GENERATED by evinvest-i18n-slices/);
    expect(written["shell"]).toEqual(["err.title", "nav.home"]);
  });

  it("passes --check when the file matches the code", () => {
    runSlices(["--root", root, "--config", CONFIG()]);
    const exit = exits();

    runSlices(["--root", root, "--config", CONFIG(), "--check"]);

    expect(exit).not.toHaveBeenCalled();
  });

  it("fails --check when the code has drifted from the file", () => {
    runSlices(["--root", root, "--config", CONFIG()]);
    write("components/lazy.tsx", 'export default () => t("lazy.renamed", "Lazy");\n');
    const exit = exits();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => runSlices(["--root", root, "--config", CONFIG(), "--check"])).toThrow("exit 1");
    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("is out of date with the code"));
  });

  it("fails --check when there is no file", () => {
    const exit = exits();
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => runSlices(["--root", root, "--config", CONFIG(), "--check"])).toThrow("exit 1");
    expect(exit).toHaveBeenCalledWith(1);
    expect(existsSync(OUT())).toBe(false);
  });

  it("exits non-zero without writing when the graph has errors", () => {
    write(INVEST, 'import "./gone";\n');
    exits();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => runSlices(["--root", root, "--config", CONFIG()])).toThrow("exit 1");
    expect(error).toHaveBeenCalledWith(expect.stringContaining('cannot resolve "./gone"'));
    expect(existsSync(OUT())).toBe(false);
  });

  it("rejects an unknown top-level field in the config", () => {
    write("slices.config.json", JSON.stringify({ tables: [TIPS], table: "tips/copy.ts" }));

    expect(() => runSlices(["--root", root, "--config", CONFIG()])).toThrow("unknown field table");
  });

  it("rejects an unknown field in a table rule", () => {
    write("slices.config.json", JSON.stringify({ tables: [{ ...TIPS, ignored: [] }] }));

    expect(() => runSlices(["--root", root, "--config", CONFIG()])).toThrow("tables[0]: unknown field ignored");
  });

  it("serialises exactly what it writes", () => {
    runSlices(["--root", root, "--config", CONFIG()]);
    const { slices } = messageSlices({ root, tables: [TIPS] });

    expect(readFileSync(OUT(), "utf8")).toBe(serialiseSlices(slices));
  });
});
