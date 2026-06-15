import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "../src/components/context-menu";

describe("ContextMenu", () => {
  it("hides its content until the trigger is right-clicked", () => {
    const { getByText, queryByText } = render(
      <ContextMenu>
        <ContextMenuTrigger>area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Back</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );
    expect(queryByText("Back")).toBeNull();
    fireEvent.contextMenu(getByText("area"));
    const item = getByText("Back");
    expect(item).toBeInTheDocument();
    expect(item).toHaveAttribute("role", "menuitem");
  });

  it("positions content at the cursor and exposes data-slot/data-state/role", () => {
    const { getByText } = render(
      <ContextMenu>
        <ContextMenuTrigger>area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Back</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );
    fireEvent.contextMenu(getByText("area"), { clientX: 30, clientY: 40 });
    const content = getByText("Back").parentElement as HTMLElement;
    expect(content).toHaveAttribute("data-slot", "context-menu-content");
    expect(content).toHaveAttribute("data-state", "open");
    expect(content).toHaveAttribute("role", "menu");
    expect(content.style.left).toBe("30px");
    expect(content.style.top).toBe("40px");
  });

  it("closes the menu when an item is selected", () => {
    const { getByText, queryByText } = render(
      <ContextMenu>
        <ContextMenuTrigger>area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Back</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );
    fireEvent.contextMenu(getByText("area"));
    fireEvent.click(getByText("Back"));
    expect(queryByText("Back")).toBeNull();
  });
});
