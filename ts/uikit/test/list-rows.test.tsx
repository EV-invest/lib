import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ListRow, ListRowLabel, ListRowValue, ListRows } from "../src/components/list-rows";

describe("ListRows", () => {
  it("is a list whose rows are split by hairlines", () => {
    const { container, getAllByRole } = render(
      <ListRows>
        <ListRow label="Kind" value="api" />
        <ListRow label="Created" value="2026-10-03" />
      </ListRows>,
    );
    const list = container.querySelector('[data-slot="list-rows"]')!;
    expect(list.tagName).toBe("UL");
    expect(list).toHaveClass("divide-y", "divide-border");
    expect(list).toHaveAttribute("data-variant", "plain");
    expect(getAllByRole("listitem")).toHaveLength(2);
  });

  it("plain rows sit flush in a padded container; card rows pad to the card edge", () => {
    const { container, rerender } = render(
      <ListRows>
        <ListRow label="a" />
      </ListRows>,
    );
    const row = () => container.querySelector('[data-slot="list-row"]')!;
    expect(row()).toHaveClass("px-[var(--ev-list-row-x,0px)]");
    expect(container.querySelector('[data-slot="list-rows"]')!.className).not.toContain("--ev-list-row-x");

    rerender(
      <ListRows variant="card">
        <ListRow label="a" />
      </ListRows>,
    );
    expect(container.querySelector('[data-slot="list-rows"]')).toHaveClass("[--ev-list-row-x:1rem]");
  });

  it("a row's own inset still beats the list's", () => {
    const { container } = render(
      <ListRows variant="card">
        <ListRow className="px-6" label="a" />
      </ListRows>,
    );
    const row = container.querySelector('[data-slot="list-row"]')!;
    expect(row).toHaveClass("px-6");
    expect(row.className).not.toContain("--ev-list-row-x");
  });
});

describe("ListRow", () => {
  it("lays out label and description leading, value trailing, then children", () => {
    const { container, getByText } = render(
      <ul>
        <ListRow label="Key" description="api · aquafix" value="1,250" data-testid="row">
          <button type="button">Revoke</button>
        </ListRow>
      </ul>,
    );
    const row = container.querySelector('[data-slot="list-row"]')!;
    const parts = Array.from(row.children).map((el) => el.getAttribute("data-slot") ?? el.tagName);
    expect(parts).toEqual(["list-row-label", "list-row-value", "BUTTON"]);
    expect(getByText("Key")).toHaveClass("text-sm", "font-medium", "text-ink");
    expect(getByText("api · aquafix")).toHaveAttribute("data-slot", "list-row-description");
    expect(getByText("1,250")).toHaveClass("text-right", "truncate", "tabular-nums", "text-ink-soft");
  });

  it("renders only its children when given no label or value", () => {
    const { container } = render(
      <ul>
        <ListRow>
          <span>custom</span>
        </ListRow>
      </ul>,
    );
    const row = container.querySelector('[data-slot="list-row"]')!;
    expect(row.children).toHaveLength(1);
    expect(row.querySelector('[data-slot="list-row-label"]')).toBeNull();
  });

  it("exports the parts for a row composed by hand", () => {
    const { getByText } = render(
      <ul>
        <ListRow>
          <ListRowLabel description="sub">Title</ListRowLabel>
          <ListRowValue className="text-ink">42</ListRowValue>
        </ListRow>
      </ul>,
    );
    expect(getByText("sub")).toBeInTheDocument();
    expect(getByText("42")).toHaveClass("text-ink");
    expect(getByText("42")).not.toHaveClass("text-ink-soft");
  });
});
