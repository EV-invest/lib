import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Table,
  TableBody,
  TableFooter,
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
    expect(cell).toHaveClass("p-2");
    expect(cell).toHaveClass("[&:has([role=checkbox])]:pr-0");
  });
});
