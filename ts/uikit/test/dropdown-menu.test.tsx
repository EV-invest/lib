import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../src/components/dropdown-menu";

describe("DropdownMenu", () => {
  it("hides its content until the trigger is clicked", () => {
    const { getByText, queryByText } = render(
      <DropdownMenu>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Profile</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(queryByText("Profile")).toBeNull();
    fireEvent.click(getByText("open"));
    const item = getByText("Profile");
    expect(item).toBeInTheDocument();
    expect(item).toHaveAttribute("role", "menuitem");
  });

  it("sets content data-slot, data-state and role when open", () => {
    const { getByText } = render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Profile</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const item = getByText("Profile");
    const content = item.parentElement as HTMLElement;
    expect(content).toHaveAttribute("data-slot", "dropdown-menu-content");
    expect(content).toHaveAttribute("data-state", "open");
    expect(content).toHaveAttribute("role", "menu");
  });

  it("closes the menu when an item is selected", () => {
    const { getByText, queryByText } = render(
      <DropdownMenu>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Profile</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    fireEvent.click(getByText("open"));
    fireEvent.click(getByText("Profile"));
    expect(queryByText("Profile")).toBeNull();
  });

  it("reports changes through onOpenChange", () => {
    let last: boolean | undefined;
    const { getByText } = render(
      <DropdownMenu onOpenChange={(o) => (last = o)}>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Profile</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    fireEvent.click(getByText("open"));
    expect(last).toBe(true);
  });
});
