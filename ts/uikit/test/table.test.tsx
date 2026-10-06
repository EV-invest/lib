import * as React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Table,
  TableBody,
  TableCard,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "../src/components/table";

describe("Table", () => {
  it("wraps the table in a scroll container", () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const wrapper = container.querySelector('[data-slot="table-container"]')!;
    expect(wrapper).toHaveClass("overflow-x-auto");
    const table = container.querySelector('[data-slot="table"]')!;
    expect(table.tagName).toBe("TABLE");
    expect(table).toHaveClass("caption-bottom");
  });

  it("row uses the landing hover/selected canon", () => {
    const { container } = render(
      <table>
        <tbody>
          <TableRow>
            <td>r</td>
          </TableRow>
        </tbody>
      </table>,
    );
    const row = container.querySelector('[data-slot="table-row"]')!;
    expect(row).toHaveClass("hover:bg-muted/50");
    expect(row).toHaveClass("data-[state=selected]:bg-muted");
  });

  it("footer is landing-only canon", () => {
    const { container } = render(
      <table>
        <TableFooter>
          <tr>
            <td>f</td>
          </tr>
        </TableFooter>
      </table>,
    );
    const footer = container.querySelector('[data-slot="table-footer"]')!;
    expect(footer.tagName).toBe("TFOOT");
    expect(footer).toHaveClass("bg-muted/50");
    expect(footer).toHaveClass("[&>tr]:last:border-b-0");
  });

  it("cell uses landing padding and checkbox rules", () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <TableCell>c</TableCell>
          </tr>
        </tbody>
      </table>,
    );
    const cell = container.querySelector('[data-slot="table-cell"]')!;
    // Geometry reads the table's inherited custom properties, falling back to
    // the default `p-2`.
    expect(cell).toHaveClass("px-[var(--table-px,calc(var(--spacing)*2))]");
    expect(cell).toHaveClass("py-[var(--table-dense-py,var(--table-py,calc(var(--spacing)*2)))]");
    expect(cell).toHaveClass("[&:has([role=checkbox])]:pr-0");
  });
});

function tableOf(props: React.ComponentProps<typeof Table>) {
  return render(
    <Table {...props}>
      <TableHeader>
        <TableRow>
          <TableHead>h</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>c</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );
}

describe("Table variant and density", () => {
  it("defaults reset the inherited geometry and say so in data attributes", () => {
    const { container } = tableOf({});
    const table = container.querySelector('[data-slot="table"]')!;
    expect(table).toHaveAttribute("data-variant", "default");
    expect(table).toHaveAttribute("data-density", "default");
    // Nested in a card table, a default one must not wear the card geometry.
    expect(table).toHaveClass("[--table-px:initial]", "[--table-head-case:initial]", "[--table-dense-py:initial]");
    expect(table.className).not.toContain("calc(var(--spacing)*5)");
  });

  it("card sets the head and cell properties and drops the head-row hover", () => {
    const { container } = tableOf({ variant: "card" });
    const table = container.querySelector('[data-slot="table"]')!;
    expect(table).toHaveAttribute("data-variant", "card");
    expect(table).toHaveClass(
      "[--table-px:calc(var(--spacing)*5)]",
      "[--table-py:calc(var(--spacing)*3)]",
      "[--table-head-case:uppercase]",
      "[&>thead>tr:hover]:bg-transparent",
    );
  });

  it("compact tightens rows on top of card", () => {
    const { container } = tableOf({ variant: "card", density: "compact" });
    const table = container.querySelector('[data-slot="table"]')!;
    expect(table).toHaveAttribute("data-density", "compact");
    expect(table).toHaveClass(
      "[--table-px:calc(var(--spacing)*5)]",
      "[--table-dense-py:calc(var(--spacing)*1.5)]",
      "[--table-head-h:calc(var(--spacing)*8)]",
    );
  });

  it("merges the caller's className last", () => {
    const { container } = tableOf({ variant: "card", className: "text-xs" });
    expect(container.querySelector('[data-slot="table"]')).toHaveClass("text-xs");
  });

  it("a cell's own padding still beats the card's", () => {
    const { container } = render(
      <Table variant="card">
        <TableBody>
          <TableRow>
            <TableCell className="px-0">c</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const cell = container.querySelector('[data-slot="table-cell"]')!;
    expect(cell).toHaveClass("px-0");
    expect(cell.className).not.toContain("px-[var(--table-px");
  });
});

describe("TableHead / TableCell align", () => {
  it("end right-aligns with tabular numerals and leaks no align attribute", () => {
    const { container } = render(
      <table>
        <thead>
          <tr>
            <TableHead align="end">h</TableHead>
          </tr>
        </thead>
        <tbody>
          <tr>
            <TableCell align="end">1.00</TableCell>
          </tr>
        </tbody>
      </table>,
    );
    for (const slot of ["table-head", "table-cell"]) {
      const el = container.querySelector(`[data-slot="${slot}"]`)!;
      expect(el).toHaveClass("text-end", "tabular-nums");
      expect(el).not.toHaveClass("text-start");
      expect(el).not.toHaveAttribute("align");
    }
  });

  it("start and no align keep the start edge without tabular numerals", () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <TableCell align="start">a</TableCell>
            <TableCell>b</TableCell>
          </tr>
        </tbody>
      </table>,
    );
    const [a, b] = container.querySelectorAll('[data-slot="table-cell"]');
    expect(a).toHaveClass("text-start");
    expect(a).not.toHaveClass("tabular-nums");
    expect(b).not.toHaveClass("text-end");
    expect(b).not.toHaveClass("tabular-nums");
  });

  it("a cell's own text alignment wins over align", () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <TableCell align="end" className="text-center">x</TableCell>
          </tr>
        </tbody>
      </table>,
    );
    const cell = container.querySelector('[data-slot="table-cell"]')!;
    expect(cell).toHaveClass("text-center", "tabular-nums");
    expect(cell).not.toHaveClass("text-end");
  });
});

describe("TableCard", () => {
  it("is the paddingless card surface and merges the caller's className", () => {
    const { container } = render(<TableCard className="max-w-sm">x</TableCard>);
    const card = container.querySelector('[data-slot="table-card"]')!;
    expect(card.tagName).toBe("DIV");
    expect(card).toHaveClass("bg-card", "rounded-xl", "border", "overflow-hidden", "max-w-sm");
    expect(card.className).not.toMatch(/(^|\s)p[xy]?-/);
  });
});
