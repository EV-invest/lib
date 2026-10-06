import { describe, expect, it } from "vitest";
import { abAssignments, abReset, abSwitcherVisible, abVariantUrl, cookieValue } from "../src/index";

describe("abSwitcherVisible", () => {
  it("hides in production from a visit without the QA cookie", () => {
    expect(abSwitcherVisible("", "ab__qa", "production")).toBe(false);
    expect(abSwitcherVisible("ab_lead_form=b; theme=dark", "ab__qa", "production")).toBe(false);
  });

  it("shows in production to a visit with the QA cookie set", () => {
    expect(abSwitcherVisible("ab_lead_form=b; ab__qa=1", "ab__qa", "production")).toBe(true);
    expect(abSwitcherVisible("ab_forced=1", "ab_forced", "production")).toBe(true);
  });

  it("takes an empty QA cookie for none", () => {
    expect(abSwitcherVisible("ab__qa=; x=1", "ab__qa", "production")).toBe(false);
    expect(abSwitcherVisible("ab__qa", "ab__qa", "production")).toBe(false);
  });

  it("does not mistake a cookie whose name only contains the QA cookie's", () => {
    expect(abSwitcherVisible("xab__qa=1; ab__qa_old=1; ab__q=1", "ab__qa", "production")).toBe(false);
  });

  it("always shows outside production", () => {
    expect(abSwitcherVisible("", "ab__qa", "development")).toBe(true);
    expect(abSwitcherVisible("", "ab__qa", "test")).toBe(true);
    expect(abSwitcherVisible("", "ab__qa", undefined)).toBe(true);
  });
});

describe("cookies", () => {
  it("reads a value by exact name, decoded", () => {
    expect(cookieValue("a=1; ab_x=hello%20there", "ab_x")).toBe("hello there");
    expect(cookieValue("ab_x=%E0", "ab_x")).toBe("%E0");
    expect(cookieValue("ab_xy=1", "ab_x")).toBeNull();
  });

  it("reads each experiment's assignment, leaving out the unassigned", () => {
    expect(abAssignments("ab_lead_form=b; ab__qa=1; ab_hero=a", ["lead_form", "hero", "cta"])).toEqual({ lead_form: "b", hero: "a" });
  });
});

describe("abVariantUrl", () => {
  it("adds the force parameter, keeping the other parameters and the hash", () => {
    expect(abVariantUrl("https://x.test/fr/prices?utm_source=a#quote", "lead_form", "c")).toBe("https://x.test/fr/prices?utm_source=a&ab_lead_form=c#quote");
  });

  it("replaces an earlier force of the same experiment", () => {
    expect(abVariantUrl("https://x.test/fr?ab_lead_form=a&q=1", "lead_form", "b")).toBe("https://x.test/fr?ab_lead_form=b&q=1");
  });

  it("takes the brand's force prefix", () => {
    expect(abVariantUrl("https://x.test/", "hero", "b", "force_")).toBe("https://x.test/?force_hero=b");
  });
});

describe("abReset", () => {
  const href = "https://x.test/fr?ab_lead_form=b&ab_hero=a&utm_source=x#quote";
  const gone = (name: string) => `${name}=; path=/; max-age=0`;

  it("drops the assignments and the force parameters, keeping the QA cookie", () => {
    const plan = abReset(href, ["lead_form", "hero"], "ab__qa", "reassign");
    expect(plan.cookies).toEqual([gone("ab_lead_form"), gone("ab_hero")]);
    expect(plan.url).toBe("https://x.test/fr?utm_source=x");
  });

  it("never drops a QA cookie that looks like an assignment", () => {
    expect(abReset(href, ["_qa", "hero"], "ab__qa", "reassign").cookies).toEqual([gone("ab_hero")]);
  });

  it("leaving the test drops the QA cookie too", () => {
    const plan = abReset(href, ["lead_form", "hero"], "ab__qa", "leave");
    expect(plan.cookies).toEqual([gone("ab_lead_form"), gone("ab_hero"), gone("ab__qa")]);
    expect(plan.url).toBe("https://x.test/fr?utm_source=x");
  });

  it("drops the hash, so a page reached by an anchor still reloads", () => {
    const at = "https://x.test/fr#quote";
    for (const mode of ["reassign", "leave"] as const) expect(abReset(at, ["lead_form"], "ab__qa", mode).url).toBe("https://x.test/fr");
  });

  it("strips the brand's own force prefix, and leaves other experiments' parameters", () => {
    const plan = abReset("https://x.test/?force_hero=b&ab_hero=a&force_other=1", ["hero"], "ab_forced", "leave", "force_");
    expect(plan.url).toBe("https://x.test/?ab_hero=a&force_other=1");
    expect(plan.cookies).toEqual([gone("ab_hero"), gone("ab_forced")]);
  });
});
