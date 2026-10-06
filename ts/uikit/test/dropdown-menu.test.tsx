import { describe, it, expect } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

  describe("keyboard navigation", () => {
    const renderActions = (withDisabled = false) => {
      const utils = render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Rename</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            {withDisabled ? <DropdownMenuItem disabled>Archive</DropdownMenuItem> : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
      const menu = utils.getByRole("menu");
      const press = (key: string) => fireEvent.keyDown(document.activeElement ?? menu, { key });
      return { ...utils, press };
    };

    it("End moves focus to the last item", () => {
      const { getByText, press } = renderActions();
      expect(getByText("Rename")).toHaveFocus();
      press("End");
      expect(getByText("Delete")).toHaveFocus();
      press("Home");
      expect(getByText("Rename")).toHaveFocus();
    });

    it("ArrowDown past the last item wraps instead of piling up a hidden index", () => {
      const { getByText, press } = renderActions();
      press("ArrowDown");
      press("ArrowDown");
      expect(getByText("Delete")).toHaveFocus();
      press("ArrowDown");
      expect(getByText("Rename")).toHaveFocus();
      press("ArrowUp");
      expect(getByText("Delete")).toHaveFocus();
      press("ArrowUp");
      expect(getByText("Duplicate")).toHaveFocus();
    });

    it("reopens on the first item, even after the last one went away", async () => {
      const Menu = ({ withDelete }: { withDelete: boolean }) => (
        <DropdownMenu>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Rename</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            {withDelete ? <DropdownMenuItem>Delete</DropdownMenuItem> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      );
      const { getByText, queryByRole, rerender } = render(<Menu withDelete />);
      fireEvent.click(getByText("Actions"));
      fireEvent.keyDown(document.activeElement!, { key: "End" });
      expect(getByText("Delete")).toHaveFocus();
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      await waitFor(() => expect(queryByRole("menu")).toBeNull());
      rerender(<Menu withDelete={false} />);
      fireEvent.click(getByText("Actions"));
      await waitFor(() => expect(getByText("Rename")).toHaveFocus());
    });

    it("skips disabled items", () => {
      const { getByText, press } = renderActions(true);
      press("ArrowDown");
      press("ArrowDown");
      expect(getByText("Delete")).toHaveFocus();
      press("ArrowUp");
      expect(getByText("Duplicate")).toHaveFocus();
      press("End");
      expect(getByText("Delete")).toHaveFocus();
    });
  });
});
