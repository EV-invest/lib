import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarMenuButton,
} from "../src/components/sidebar";

describe("Sidebar", () => {
  it("seeds the expanded state and the width custom properties", () => {
    const { container } = render(
      <SidebarProvider>
        <Sidebar>body</Sidebar>
      </SidebarProvider>,
    );
    const wrapper = container.querySelector('[data-slot="sidebar-wrapper"]');
    expect(wrapper).toHaveStyle({ "--sidebar-width": "16rem" });
    const sidebar = container.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toHaveAttribute("data-state", "expanded");
  });

  it("starts collapsed when controlled open is false", () => {
    const { container } = render(
      <SidebarProvider open={false}>
        <Sidebar>x</Sidebar>
      </SidebarProvider>,
    );
    const sidebar = container.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toHaveAttribute("data-state", "collapsed");
    expect(sidebar).toHaveAttribute("data-collapsible", "offcanvas");
  });

  it("the trigger toggles the state", () => {
    const { container, getByLabelText } = render(
      <SidebarProvider>
        <Sidebar>x</Sidebar>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    const sidebar = container.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toHaveAttribute("data-state", "expanded");
    fireEvent.click(getByLabelText("Toggle Sidebar"));
    expect(sidebar).toHaveAttribute("data-state", "collapsed");
  });

  it("reports changes through onOpenChange", () => {
    let last: boolean | undefined;
    const { getByLabelText } = render(
      <SidebarProvider onOpenChange={(o) => (last = o)}>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    fireEvent.click(getByLabelText("Toggle Sidebar"));
    expect(last).toBe(false);
  });

  it("collapsible=none renders a flat container without data-state", () => {
    const { container } = render(
      <SidebarProvider>
        <Sidebar collapsible="none">y</Sidebar>
      </SidebarProvider>,
    );
    const sidebar = container.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toHaveClass("w-(--sidebar-width)");
    expect(sidebar).not.toHaveAttribute("data-state");
  });

  it("menu button carries variant, size and active state", () => {
    const { getByText } = render(
      <SidebarProvider>
        <SidebarMenuButton variant="outline" size="lg" isActive>
          go
        </SidebarMenuButton>
      </SidebarProvider>,
    );
    const el = getByText("go");
    expect(el).toHaveAttribute("data-slot", "sidebar-menu-button");
    expect(el).toHaveAttribute("data-size", "lg");
    expect(el).toHaveAttribute("data-active", "true");
    expect(el).toHaveClass("h-12");
  });

  it("menu button renders as child when asChild", () => {
    const { getByRole } = render(
      <SidebarProvider>
        <SidebarMenuButton asChild>
          <a href="#">link</a>
        </SidebarMenuButton>
      </SidebarProvider>,
    );
    const el = getByRole("link");
    expect(el.tagName).toBe("A");
    expect(el).toHaveAttribute("data-slot", "sidebar-menu-button");
  });
});
