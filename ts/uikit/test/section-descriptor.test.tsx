import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SectionDescriptor } from "../src/components/section-descriptor";

describe("SectionDescriptor", () => {
  it("renders a titled <section> with title and body slots", () => {
    const { getByText, container } = render(
      <SectionDescriptor title="How withdrawals work">
        Accept and queue.
      </SectionDescriptor>,
    );
    expect(getByText("How withdrawals work")).toBeInTheDocument();
    expect(getByText("Accept and queue.")).toBeInTheDocument();
    const root = container.querySelector('[data-slot="section-descriptor"]');
    expect(root?.tagName).toBe("SECTION");
    expect(
      container.querySelector('[data-slot="section-descriptor-title"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="section-descriptor-body"]'),
    ).toBeTruthy();
  });

  it("renders as a native <details> disclosure when collapsible", () => {
    const { container } = render(
      <SectionDescriptor collapsible title="Working with fund shares">
        body
      </SectionDescriptor>,
    );
    const root = container.querySelector('[data-slot="section-descriptor"]');
    expect(root?.tagName).toBe("DETAILS");
    expect(container.querySelector("summary")).toBeTruthy();
  });

  it("shows the leading ⓘ mark by default and omits it when icon=false", () => {
    const withIcon = render(<SectionDescriptor title="t">b</SectionDescriptor>);
    expect(withIcon.container.querySelector("svg")).toBeTruthy();

    const withoutIcon = render(
      <SectionDescriptor icon={false} title="t">
        b
      </SectionDescriptor>,
    );
    expect(withoutIcon.container.querySelector("svg")).toBeNull();
  });

  it("merges a caller className onto the container", () => {
    const { container } = render(
      <SectionDescriptor className="custom-x" title="t">
        b
      </SectionDescriptor>,
    );
    expect(
      container.querySelector('[data-slot="section-descriptor"]')?.className,
    ).toContain("custom-x");
  });
});
