import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from "../src/components/menubar";

describe("Menubar", () => {
  it("renders the bar with role and slot", () => {
    const { getByRole } = render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
        </MenubarMenu>
      </Menubar>,
    );
    const bar = getByRole("menubar");
    expect(bar).toHaveAttribute("data-slot", "menubar");
  });

  it("keeps content unmounted until the trigger opens it", () => {
    const { getByText, queryByRole } = render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>New</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>,
    );
    expect(queryByRole("menu")).toBeNull();
    fireEvent.click(getByText("File"));
    const menu = queryByRole("menu");
    expect(menu).not.toBeNull();
    expect(menu).toHaveAttribute("data-state", "open");
    expect(getByText("New")).toHaveAttribute("data-slot", "menubar-item");
  });

  it("opens via defaultOpen and renders separator + shortcut", () => {
    const { getByText, getByRole } = render(
      <Menubar>
        <MenubarMenu defaultOpen>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>
              New <MenubarShortcut>⌘N</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
          </MenubarContent>
        </MenubarMenu>
      </Menubar>,
    );
    expect(getByRole("menu")).toHaveAttribute("data-state", "open");
    expect(getByText("⌘N")).toHaveAttribute("data-slot", "menubar-shortcut");
  });

  it("renders a checked checkbox item with the check icon", () => {
    const { getByRole } = render(
      <Menubar>
        <MenubarMenu defaultOpen>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarCheckboxItem checked>Status Bar</MenubarCheckboxItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>,
    );
    const item = getByRole("menuitemcheckbox");
    expect(item).toHaveAttribute("aria-checked", "true");
    expect(item.querySelector("path")).toHaveAttribute("d", "M20 6 9 17l-5-5");
  });

  it("marks the selected radio item", () => {
    const { getAllByRole } = render(
      <Menubar>
        <MenubarMenu defaultOpen>
          <MenubarTrigger>Profile</MenubarTrigger>
          <MenubarContent>
            <MenubarRadioGroup defaultValue="a">
              <MenubarRadioItem value="a">Andy</MenubarRadioItem>
              <MenubarRadioItem value="b">Ben</MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>,
    );
    const items = getAllByRole("menuitemradio");
    expect(items[0]).toHaveAttribute("aria-checked", "true");
    expect(items[1]).toHaveAttribute("aria-checked", "false");
    fireEvent.click(items[1]!);
    expect(getAllByRole("menuitemradio")[1]).toHaveAttribute("aria-checked", "true");
  });

  it("renders a sub-trigger with chevron and sub-content", () => {
    const { getByText } = render(
      <Menubar>
        <MenubarMenu defaultOpen>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarSub defaultOpen>
              <MenubarSubTrigger inset>Share</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem>Email</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>,
    );
    const sub = getByText("Share");
    expect(sub).toHaveAttribute("data-slot", "menubar-sub-trigger");
    expect(sub.querySelector("path")).toHaveAttribute("d", "m9 18 6-6-6-6");
    expect(getByText("Email")).toBeInTheDocument();
  });
});
