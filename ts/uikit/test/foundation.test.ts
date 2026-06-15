import { describe, it, expect } from "vitest";
import { cn } from "../src/lib/cn";

describe("cn", () => {
  it("joins distinct classes", () => {
    expect(cn("flex", "items-center", "justify-center")).toBe(
      "flex items-center justify-center",
    );
  });

  it("rightmost wins on conflict (mirrors cn! in Rust)", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("bg-primary", "bg-secondary")).toBe("bg-secondary");
  });

  it("keeps refinements", () => {
    expect(cn("p-4", "py-2")).toBe("p-4 py-2");
  });

  it("drops falsy fragments", () => {
    expect(cn("px-2", false, undefined, "py-1")).toBe("px-2 py-1");
    expect(cn("")).toBe("");
  });

  it("lets an owned override beat the base", () => {
    expect(cn("h-9 px-4 py-2", "px-6")).toBe("h-9 py-2 px-6");
  });
});
