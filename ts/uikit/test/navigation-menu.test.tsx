import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "../src/components/navigation-menu";

describe("NavigationMenu", () => {
  it("renders the nav root with role and slot", () => {
    const { getByRole } = render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Docs</NavigationMenuTrigger>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    );
    const nav = getByRole("navigation");
    expect(nav).toHaveAttribute("data-slot", "navigation-menu");
    expect(nav).toHaveAttribute("data-viewport", "true");
  });

  it("renders the trigger with a chevron-down", () => {
    const { getByText } = render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Docs</NavigationMenuTrigger>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    );
    const trigger = getByText("Docs").closest("button")!;
    expect(trigger).toHaveAttribute("data-state", "closed");
    expect(trigger.querySelector("path")).toHaveAttribute("d", "m6 9 6 6 6-6");
  });

  it("toggles the content panel on click", () => {
    const { getByText, queryByText } = render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Docs</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink href="/intro">Intro</NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    );
    expect(queryByText("Intro")).toBeNull();
    fireEvent.click(getByText("Docs"));
    const link = getByText("Intro");
    expect(link).toHaveAttribute("data-slot", "navigation-menu-link");
    expect(link).toHaveAttribute("href", "/intro");
  });

  it("renders a link via asChild", () => {
    const { getByRole } = render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem defaultOpen>
            <NavigationMenuTrigger>Docs</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink asChild>
                <a href="/custom">Custom</a>
              </NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    );
    const link = getByRole("link", { name: "Custom" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("data-slot", "navigation-menu-link");
  });

  it("exposes the trigger style helper", () => {
    const cls = navigationMenuTriggerStyle();
    expect(cls).toContain("h-9");
    expect(cls).toContain("data-[state=open]:bg-accent/50");
  });
});
