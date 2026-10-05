import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  centsBucket,
  estimateField,
  flowOf,
  labelOf,
  mulBp,
  parsePricingModel,
  priceOf,
  PricingModelError,
  pricingProblems,
  pricingProblemsFor,
  readEstimateInputs,
  answeredUnknown,
  PRICING_LIMITS,
  ESTIMATE_UNKNOWN,
  roundTo,
  type PricingInputs,
  type PricingModel,
} from "../src/index";

/**
 * The fixtures the panel vendors: its validator must accept `valid/` and
 * refuse `invalid/`, and its port of `priceOf` must answer every case in
 * `cases.json` to the cent. Changing one is changing the contract.
 */
const DIR = join(import.meta.dirname, "fixtures/pricing");
const read = (path: string): unknown => JSON.parse(readFileSync(join(DIR, path), "utf8"));
const files = (dir: string) => readdirSync(join(DIR, dir)).filter(f => f.endsWith(".json")).sort();

interface Case {
  name: string;
  model: unknown;
  need: string;
  inputs: PricingInputs;
  cents: number | null;
}
const CASES = read("cases.json") as Case[];
const cleaning = (): PricingModel => parsePricingModel(read("valid/cleaning.json"));

describe("the model fixtures", () => {
  it.each(files("valid"))("valid/%s validates", file => {
    expect(pricingProblems(read(`valid/${file}`))).toEqual([]);
  });

  it.each(files("invalid"))("invalid/%s is refused, whole", file => {
    const value = read(`invalid/${file}`);
    expect(pricingProblems(value).length).toBeGreaterThan(0);
    expect(() => parsePricingModel(value)).toThrow(PricingModelError);
  });

  it("covers every input kind and both need kinds", () => {
    const models = CASES.map(c => parsePricingModel(c.model));
    const kinds = new Set(models.flatMap(m => m.inputs.map(i => i.kind)));
    expect([...kinds].sort()).toEqual(["add", "discount", "multiply"]);
    const needs = new Set(models.flatMap(m => Object.values(m.needs).map(n => n.kind)));
    expect([...needs].sort()).toEqual(["estimate", "fixed"]);
  });
});

describe("priceOf against cases.json", () => {
  it.each(CASES.map(c => [c.name, c] as const))("%s", (_, c) => {
    const price = priceOf(parsePricingModel(c.model), c.need, c.inputs);
    expect(price?.cents ?? null).toBe(c.cents);
  });

  it.each(CASES.filter(c => c.cents !== null).map(c => [c.name, c] as const))("%s: the lines add up to the total", (_, c) => {
    const price = priceOf(parsePricingModel(c.model), c.need, c.inputs);
    expect(price?.breakdown.reduce((sum, line) => sum + line.cents, 0)).toBe(price?.cents);
  });
});

describe("priceOf", () => {
  it("explains the price line by line, in the normative order", () => {
    const price = priceOf(cleaning(), "standard", { frequency: "biweekly", surface: "s70", bedrooms: "t3", zone: "proche" });
    expect(price).toEqual({
      cents: 8400,
      breakdown: [
        { kind: "base", cents: 4500 },
        { kind: "add", input: "bedrooms", option: "t3", cents: 3000 },
        { kind: "add", input: "surface", option: "s70", cents: 1000 },
        { kind: "multiply", input: "zone", option: "proche", cents: 850 },
        { kind: "discount", input: "frequency", option: "biweekly", cents: -935 },
        { kind: "rounding", cents: -15 },
      ],
    });
  });

  it("names the minimum when it raised the price", () => {
    const price = priceOf(cleaning(), "standard", { zone: "centre", bedrooms: "studio", surface: "s40", frequency: "weekly" });
    expect(price?.breakdown.at(-2)).toEqual({ kind: "rounding", cents: -25 });
    expect(price?.breakdown.at(-1)).toEqual({ kind: "minimum", cents: 1100 });
  });

  it("does not read a need or an answer off the prototype", () => {
    expect(priceOf(cleaning(), "toString", {})).toBeNull();
    const inherited = Object.create({ zone: "centre", bedrooms: "t2", surface: "s40", frequency: "once" }) as PricingInputs;
    expect(priceOf(cleaning(), "standard", inherited)).toBeNull();
  });

  it("rounds a product half up, on integers", () => {
    expect(mulBp(1, 5000)).toBe(1);
    expect(mulBp(1, 4999)).toBe(0);
    expect(mulBp(3, 5000)).toBe(2);
    expect(mulBp(100_000_000, 100_000)).toBe(1_000_000_000);
    expect(roundTo(250, 500)).toBe(500);
    expect(roundTo(249, 500)).toBe(0);
    expect(roundTo(7, 1)).toBe(7);
    expect(roundTo(0, 500)).toBe(0);
  });
});

describe("pricingProblems", () => {
  it("says where each problem is", () => {
    const model = read("valid/cleaning.json") as Record<string, unknown>;
    expect(pricingProblems({ ...model, roundToCents: 0, note: 1 })).toEqual(["model.note: unknown field", "model.roundToCents: an integer from 1 to 100000000"]);
    expect(pricingProblems(read("invalid/need-unknown-input.json"))).toEqual(['model.needs.standard.inputs[4]: no input "pets"']);
    expect(pricingProblems(read("invalid/dearest-multiply-over-cap.json"))).toEqual(["model.needs.standard: its dearest combination passes 100000000 cents"]);
    expect(pricingProblems(null)).toEqual(["model: an object"]);
  });

  it("parses to a model with nothing the input did not check", () => {
    const parsed = parsePricingModel(read("valid/cleaning.json"));
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(read("valid/cleaning.json"));
  });

  it("for a site, wants a label in every one of its locales", () => {
    expect(pricingProblemsFor(read("valid/cleaning.json"), ["fr", "en"])).toEqual([]);
    expect(pricingProblemsFor(read("valid/at-the-cap.json"), ["fr", "en"])).toContain('model.inputs[0].labels: no "fr" label');
    expect(pricingProblemsFor(null, ["fr"])).toEqual(["model: an object"]);
  });

  it("picks the page's label, else the first", () => {
    expect(labelOf({ fr: "Zone", en: "Area" }, "en")).toBe("Area");
    expect(labelOf({ fr: "Zone" }, "de")).toBe("Zone");
  });
});

describe("flowOf", () => {
  const flows = { standard: "estimate", windows: "fixed", deep: "quote", move: "estimate" } as const;

  it("runs the brand's flow when the model prices the need that way", () => {
    expect(flowOf(flows, cleaning(), "standard")).toBe("estimate");
    expect(flowOf(flows, cleaning(), "windows")).toBe("fixed");
  });

  it("is a quote otherwise — never a form with no price", () => {
    expect(flowOf(flows, cleaning(), "deep")).toBe("quote");
    expect(flowOf(flows, cleaning(), "move")).toBe("quote");
    expect(flowOf({ standard: "fixed" }, cleaning(), "standard")).toBe("quote");
    expect(flowOf(flows, null, "standard")).toBe("quote");
    expect(flowOf(undefined, cleaning(), "standard")).toBe("quote");
    expect(flowOf(flows, cleaning(), undefined)).toBe("quote");
    expect(flowOf(flows, cleaning(), "constructor")).toBe("quote");
  });
});

describe("readEstimateInputs", () => {
  it("reads only the need's inputs, and only slugs", () => {
    const posted = new Map([
      [estimateField("zone"), "centre"],
      [estimateField("bedrooms"), " t2 "],
      [estimateField("surface"), "<b>"],
      [estimateField("pets"), "cat"],
      ["quoted_cents", "1"],
    ]);
    expect(readEstimateInputs(cleaning(), "standard", f => posted.get(f) ?? null)).toEqual({ zone: "centre", bedrooms: "t2" });
    expect(readEstimateInputs(cleaning(), "windows", f => posted.get(f) ?? null)).toEqual({});
  });
});

describe("answeredUnknown", () => {
  it("is an answer \"I don't know\" to one of the need's own questions, never a slug a model could price", () => {
    expect(PRICING_LIMITS.slug.test(ESTIMATE_UNKNOWN)).toBe(false);
    const posted = new Map([[estimateField("surface"), ` ${ESTIMATE_UNKNOWN} `]]);
    expect(answeredUnknown(cleaning(), "standard", f => posted.get(f) ?? null)).toBe(true);
    expect(answeredUnknown(cleaning(), "windows", f => posted.get(f) ?? null)).toBe(false);
    expect(answeredUnknown(cleaning(), "standard", () => "t2")).toBe(false);
  });
});

describe("centsBucket", () => {
  it.each([
    [0, "0-2500"],
    [2499, "0-2500"],
    [2500, "2500-5000"],
    [8400, "7500-10000"],
    [18_800, "15000-20000"],
    [99_999, "50000-100000"],
    [100_000, "100000+"],
    [100_000_000, "100000+"],
  ])("%i cents is %s", (cents, bucket) => {
    expect(centsBucket(cents)).toBe(bucket);
  });
});
