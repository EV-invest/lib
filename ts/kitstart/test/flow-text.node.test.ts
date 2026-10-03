import { describe, expect, it } from "vitest";
import { ALLOWED_PROPS, EVENTS, flowTextOf, formatCents, LEAD_CAPTURE_TEXT, type LeadCaptureText } from "../src/index";

describe("formatCents", () => {
  it("writes euros in the page's language, cents only when there are some", () => {
    expect(formatCents(8400, "fr")).toMatch(/^84\s€$/);
    expect(formatCents(8450, "fr")).toMatch(/^84,50\s€$/);
    expect(formatCents(8450, "en")).toBe("€84.50");
    expect(formatCents(850, "fr", true)).toMatch(/^\+8,50\s€$/);
    expect(formatCents(-935, "fr", true)).toMatch(/^−9,35\s€$/);
    expect(formatCents(0, "fr")).toMatch(/^0\s€$/);
  });
});

describe("the flows' words", () => {
  it("fall back to the kit's, in the page's language, key by key", () => {
    expect(flowTextOf({ ...LEAD_CAPTURE_TEXT.fr, bookSubmit: "Réserver ce prix" }, "fr").bookSubmit).toBe("Réserver ce prix");
    const older: LeadCaptureText = { ...LEAD_CAPTURE_TEXT.en };
    delete older.slotCallback;
    expect(flowTextOf(older, "en-GB").slotCallback).toBe("We will call you to set the slot.");
    expect(flowTextOf(older, "de").slotCallback).toBe("Nous vous rappelons pour fixer le créneau.");
  });
});

describe("the flows' events", () => {
  it("are named, and carry only allowed properties", () => {
    expect(EVENTS.estimateShown).toBe("lead_estimate_shown");
    for (const prop of ["need", "cents_bucket"]) expect(ALLOWED_PROPS).toContain(prop);
  });
});
