import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import { brandFromToml, PaletteError, parseToml, readContract, readRules, renderPalette, type BrandConfig } from "../src/palette";

const sheet = readFileSync(join(process.cwd(), "styles/tokens.css"), "utf8");
const contract = readContract(sheet);
const demo = readFileSync(join(process.cwd(), "test/fixtures/aquafix-demo.brand.toml"), "utf8");

function problems(run: () => unknown): readonly string[] {
  try {
    run();
  } catch (error) {
    if (error instanceof PaletteError) return error.problems;
    throw error;
  }
  throw new Error("expected a PaletteError");
}

function complete(): Record<string, string> {
  return Object.fromEntries(contract.required.map((name) => [name, "#123456"]));
}

describe("readContract", () => {
  it("reads the colour names off the sheet's @theme mapping", () => {
    expect(contract.required).toContain("background");
    expect(contract.required).toContain("primary-ink");
    expect(contract.required).toContain("chart-5");
    expect(contract.required).not.toContain("border");
    expect(contract.required).toHaveLength(28);
  });

  it("refuses a sheet that is not the kit's contract", () => {
    expect(() => readContract(":root { --background: #fff; }")).toThrow(/@theme inline/);
  });
});

describe("parseToml", () => {
  it("reads the subset a brand file uses", () => {
    expect(
      parseToml(`# comment
wordmark = ["AQUA", "FIX"] # trailing
[colors.light]
background = "#ffffff" # a hash inside a string is not a comment
[fonts]
weights = [400, 500]
on = true
escaped = "a\\"b\\\\c"`),
    ).toEqual({
      wordmark: ["AQUA", "FIX"],
      colors: { light: { background: "#ffffff" } },
      fonts: { weights: [400, 500], on: true, escaped: 'a"b\\c' },
    });
  });

  it.each([
    ["[[array.of.tables]]", /plain \[table\]/],
    ['"quoted key" = 1', /bare keys/],
    ["a = 1\na = 2", /duplicate key/],
    ["a = {inline = 1}", /unsupported value/],
    ['a = """multi', /unterminated string|one string/],
    ["[colors.light]\na = 1\n[colors.light]\nb = 2", /duplicate table header/],
    ['a = "\\u0041"', /unsupported escape/],
    ['a = "\\q"', /unsupported escape/],
  ])("rejects %j rather than misreading it", (text, message) => {
    expect(() => parseToml(text)).toThrow(message);
  });
});

describe("brandFromToml + renderPalette", () => {
  it("scopes light as the brand's default and dark under its polarity class", () => {
    const css = renderPalette("aqua", brandFromToml(demo), contract);
    const selectors = readRules(css).map((r) => r.selector);
    expect(selectors).toEqual([
      '[data-brand="aqua"], [data-brand="aqua"].light, [data-brand="aqua"] .light',
      '[data-brand="aqua"].dark, [data-brand="aqua"] .dark',
      '[data-brand="aqua"]',
    ]);
    expect(css).toContain('--brand-mark: url("/brands/aquafix-mark.svg");');
    expect(css).toContain("--brand-aspect: 86.6 / 100;");
  });

  it("leaves the derived tokens to the contract unless the brand pins them", () => {
    const css = renderPalette("aqua", brandFromToml(demo), contract);
    expect(css).not.toMatch(/--border:/);
    const pinned: BrandConfig = { colors: { light: { ...complete(), border: "#dce3ea" }, dark: complete() } };
    expect(renderPalette("aqua", pinned, contract)).toContain("--border: #dce3ea;");
  });

  it("names every token either polarity is missing — aquafix's file predates primary-ink and charts", () => {
    const aquafix = demo
      .split("\n")
      .filter((line) => !/^(primary-ink|chart-\d) =/.test(line))
      .join("\n");
    const found = problems(() => renderPalette("aquafix", brandFromToml(aquafix), contract));
    expect(found).toEqual([
      "light is missing primary-ink, chart-1, chart-2, chart-3, chart-4, chart-5",
      "dark is missing primary-ink, chart-1, chart-2, chart-3, chart-4, chart-5",
    ]);
  });

  it("rejects names the contract does not have, and values that could escape the declaration", () => {
    const config: BrandConfig = {
      colors: { light: { ...complete(), sepia: "#000000" }, dark: { ...complete(), ink: "red; } body { x: y" } },
      mark: 'x") ; evil',
    };
    const found = problems(() => renderPalette("Bad Slug", config, contract));
    expect(found).toHaveLength(4);
    expect(found.join("\n")).toMatch(/lowercase slug/);
    expect(found.join("\n")).toMatch(/light\.sepia is not a token/);
    expect(found.join("\n")).toMatch(/dark\.ink = .* is not #hex/);
    expect(found.join("\n")).toMatch(/mark .* is not a plain URL/);
  });

  it("accepts a reference to another token as a value", () => {
    const config: BrandConfig = { colors: { light: { ...complete(), "on-secondary": "var(--ink)" }, dark: complete() } };
    expect(renderPalette("aqua", config, contract)).toContain("--on-secondary: var(--ink);");
  });

  it("declares each scope's polarity for what the platform draws", () => {
    const rules = readRules(renderPalette("aqua", brandFromToml(demo), contract));
    expect(rules[0]?.declarations.get("scheme")).toBe("light");
    expect(rules[1]?.declarations.get("scheme")).toBe("dark");
  });

  it("writes the brand file's families as the font parameters, `text` being sans", () => {
    const css = renderPalette("aqua", brandFromToml(demo), contract);
    expect(css).toContain('--brand-font-display: "Archivo";');
    expect(css).toContain('--brand-font-sans: "Inter";');
    expect(css).not.toContain("--brand-font-mono");
  });

  it("omits the font parameters a brand does not set, so the kit's families stand", () => {
    const config: BrandConfig = { colors: { light: complete(), dark: complete() } };
    expect(renderPalette("aqua", config, contract)).not.toContain("--brand-font-");
  });

  it("rejects a family name that could escape its quotes", () => {
    const config: BrandConfig = { colors: { light: complete(), dark: complete() }, fonts: { display: 'x"; } body {' } };
    expect(problems(() => renderPalette("aqua", config, contract))).toEqual([
      'fonts.display "x\\"; } body {" is not a plain family name',
    ]);
  });

  it("rejects a reference to a name the contract does not have", () => {
    const config: BrandConfig = { colors: { light: { ...complete(), primary: "var(--primry-ink)" }, dark: complete() } };
    expect(problems(() => renderPalette("aqua", config, contract))).toEqual([
      "light.primary refers to --primry-ink, which is not a token of the contract",
    ]);
  });

  it.each([
    ["a self-reference", { ink: "var(--ink)" }, "--ink → --ink"],
    ["a loop between two tokens", { primary: "var(--brand)", brand: "var(--primary)" }, "--brand → --primary → --brand"],
    // `border` is left to the contract, whose formula reads `ink`
    ["a loop through a derived default", { ink: "var(--border)" }, "--ink → --border → --ink"],
  ])("rejects %s", (_, overrides, cycle) => {
    const config: BrandConfig = { colors: { light: complete(), dark: { ...complete(), ...overrides } } };
    const found = problems(() => renderPalette("aqua", config, contract));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^dark has a reference cycle: /);
    expect(found[0]).toContain(cycle);
  });

  it("accepts a reference to a derived token it leaves to the contract", () => {
    const config: BrandConfig = { colors: { light: { ...complete(), "on-secondary": "var(--ink-soft)" }, dark: complete() } };
    expect(renderPalette("aqua", config, contract)).toContain("--on-secondary: var(--ink-soft);");
  });

  it("keeps the source name from closing the header comment", () => {
    const css = renderPalette("aqua", brandFromToml(demo), contract, "evil */ body { color: red } /*.toml");
    expect(readRules(css).map((r) => r.selector)).not.toContain("body");
    expect(css.split("*/")[0]).toContain("evil *\\/ body");
  });

  it.each(["/a<b.svg", "/a>b.svg", "/a'b.svg", "/a`b.svg", "/a\\b.svg", "/a b.svg", '/a"b.svg'])(
    "rejects the mark URL %j",
    (mark) => {
      const config: BrandConfig = { colors: { light: complete(), dark: complete() }, mark };
      expect(problems(() => renderPalette("aqua", config, contract))).toEqual([
        `mark ${JSON.stringify(mark)} is not a plain URL`,
      ]);
    },
  );

  it("requires both polarities", () => {
    expect(problems(() => brandFromToml('[colors.light]\nink = "#000000"'))).toEqual(["no [colors.dark] table"]);
    expect(problems(() => brandFromToml('[colors.sepia]\nink = "#000000"'))).toContain(
      "[colors.sepia] is not a polarity (light, dark)",
    );
  });
});
