import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { collect, InputError, messageSlices, runSlices, serialiseSlices, type TableRule } from "../src/extract/index";

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
      where: "shell/nav.tsx:7",
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
    expect(errors.join("\n")).toMatch(/shell\/nav\.tsx:7[\s\S]*scripts\/bad\.ts:3|scripts\/bad\.ts:3[\s\S]*shell\/nav\.tsx:7/);
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

  it("reports an @/ alias when there is no tsconfig to map it", () => {
    rmSync(join(root, "tsconfig.json"));

    const { errors } = messageSlices({ root, tables: [TIPS] });

    // Without the error, nav.home, panel.k, helper.k and lazy.k fell to serverOnly silently.
    expect(errors).toContain(
      'app/[locale]/layout.tsx:3: cannot resolve "@/shell/nav" — a local import the graph cannot follow' +
        " (it is an alias, not a package, and no tsconfig was read to map it)",
    );
  });

  it("reports an @/ alias the tsconfig's paths do not map", () => {
    write("tsconfig.json", JSON.stringify({ compilerOptions: { paths: { "#lib/*": ["./components/*"] } } }));

    const { errors } = messageSlices({ root, tables: [TIPS] });

    expect(errors).toContain(
      'app/[locale]/layout.tsx:3: cannot resolve "@/shell/nav" — a local import the graph cannot follow' +
        " (it is an alias, not a package, and the tsconfig's paths do not map it)",
    );
  });

  it("reports ~/ and # specifiers nothing maps", () => {
    write(INVEST, 'import { A } from "~/components/a";\nimport { B } from "#components/b";\nexport default () => <A />;\n');

    const { errors } = messageSlices({ root, tables: [TIPS] });

    expect(errors).toEqual([
      `${INVEST}:1: cannot resolve "~/components/a" — a local import the graph cannot follow` +
        " (it is an alias, not a package, and the tsconfig's paths do not map it)",
      `${INVEST}:2: cannot resolve "#components/b" — a local import the graph cannot follow` +
        " (it is an alias, not a package, and the tsconfig's paths do not map it)",
    ]);
  });

  it("follows a # specifier the tsconfig's paths map", () => {
    write("tsconfig.json", JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"], "#lib/*": ["./components/*"] } } }));
    write(INVEST, 'import { Panel } from "#lib/panel";\nexport default () => <Panel />;\n');

    const { slices, errors } = messageSlices({ root, tables: [TIPS] });

    expect(errors).toEqual([]);
    expect(slices.routes[INVEST]).toEqual(["helper.k", "lazy.k", "panel.k"]);
  });

  it("stops at scoped and bare package imports without an error", () => {
    rmSync(join(root, "tsconfig.json"));
    write(
      INVEST,
      'import { useState } from "react";\nimport { x } from "@scope/pkg";\nimport { y } from "@scope/pkg/sub";\nexport default () => null;\n',
    );

    const { errors } = messageSlices({ root, tables: [TIPS] });

    expect(errors.filter(error => error.startsWith(INVEST))).toEqual([]);
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
    expect(() => runSlices(["--root", root, "--config", CONFIG()])).toThrow(InputError);
  });

  it("rejects an unknown field in a table rule", () => {
    write("slices.config.json", JSON.stringify({ tables: [{ ...TIPS, ignored: [] }] }));

    expect(() => runSlices(["--root", root, "--config", CONFIG()])).toThrow("tables[0]: unknown field ignored");
    expect(() => runSlices(["--root", root, "--config", CONFIG()])).toThrow(InputError);
  });

  it("serialises exactly what it writes", () => {
    runSlices(["--root", root, "--config", CONFIG()]);
    const { slices } = messageSlices({ root, tables: [TIPS] });

    expect(readFileSync(OUT(), "utf8")).toBe(serialiseSlices(slices));
  });
});

describe("runSlices arguments", () => {
  const OUT = () => join(root, "i18n-slices.json");
  const CONFIG = () => join(root, "slices.config.json");
  const COMMITTED = "committed by hand\n";

  beforeEach(() => {
    write("i18n-slices.json", COMMITTED);
  });

  it.each([["--help"], ["-h"]])("prints the usage for %s and writes nothing", flag => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    runSlices(["--root", root, flag]);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^Usage: evinvest-i18n-slices/));
    expect(exit).not.toHaveBeenCalled();
    expect(readFileSync(OUT(), "utf8")).toBe(COMMITTED);
  });

  it.each([
    ["an unknown flag", ["--root", "ROOT", "--bogus"], "unknown flag --bogus"],
    ["--root without a value", ["--out", "OUT", "--root"], "--root needs a value"],
    ["--out followed by --check", ["--root", "ROOT", "--out", "--check"], "--out needs a value"],
  ])("rejects %s before touching the committed file", (_, argv, message) => {
    // `it.each` rows are built before `root` exists, so they name it by placeholder.
    const args = argv.map(arg => (arg === "ROOT" ? root : arg === "OUT" ? OUT() : arg));

    expect(() => runSlices(args)).toThrow(InputError);
    expect(() => runSlices(args)).toThrow(message);
    expect(readFileSync(OUT(), "utf8")).toBe(COMMITTED);
  });

  it("rejects a --config that does not exist", () => {
    expect(() => runSlices(["--root", root, "--config", join(root, "nope.json")])).toThrow(
      new InputError(`--config ${join(root, "nope.json")} cannot be read`),
    );
    expect(readFileSync(OUT(), "utf8")).toBe(COMMITTED);
  });

  it("rejects a --config that is not JSON", () => {
    write("slices.config.json", "{ tables: [");

    expect(() => runSlices(["--root", root, "--config", CONFIG()])).toThrow(InputError);
    expect(() => runSlices(["--root", root, "--config", CONFIG()])).toThrow(`${CONFIG()} is not JSON`);
    expect(readFileSync(OUT(), "utf8")).toBe(COMMITTED);
  });

  it("rejects a --root that does not exist", () => {
    const missing = join(root, "nowhere");

    expect(() => runSlices(["--root", missing])).toThrow(new InputError(`--root ${missing} does not exist`));
  });

  it("rejects a --tsconfig that does not exist", () => {
    const missing = join(root, "tsconfig.nope.json");

    expect(() => runSlices(["--root", root, "--tsconfig", missing])).toThrow(InputError);
    expect(() => runSlices(["--root", root, "--tsconfig", missing])).toThrow(`${missing} does not exist`);
    expect(readFileSync(OUT(), "utf8")).toBe(COMMITTED);
  });

  it("rejects an --app directory that does not exist", () => {
    expect(() => runSlices(["--root", root, "--app", "pages"])).toThrow(InputError);
    expect(() => runSlices(["--root", root, "--app", "pages"])).toThrow(`app directory ${join(root, "pages")} does not exist`);
    expect(readFileSync(OUT(), "utf8")).toBe(COMMITTED);
  });
});
