import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { SectionNav, type SectionNavGroup } from "../src/components/section-nav";

const GROUPS: SectionNavGroup[] = [
  {
    id: "cabinet",
    label: "Cabinet",
    description: "How the app behaves",
    items: [
      { id: "preferences", label: "Preferences" },
      { id: "notifications", label: "Notifications" },
    ],
  },
  {
    id: "profile",
    label: "Profile",
    items: [
      { id: "personal", label: "Personal", href: "/settings?section=personal" },
      { id: "documents", label: "Documents", disabled: true },
    ],
  },
];

describe("SectionNav", () => {
  it("marks the current section and switches through onValueChange", () => {
    const onValueChange = vi.fn();
    const { getByRole } = render(<SectionNav groups={GROUPS} value="preferences" onValueChange={onValueChange} />);
    expect(getByRole("button", { name: "Preferences" })).toHaveAttribute("aria-current", "true");
    fireEvent.click(getByRole("button", { name: "Notifications" }));
    expect(onValueChange).toHaveBeenCalledWith("notifications");
  });

  it("renders href items as links through linkComponent, current as a page", () => {
    const Link = (props: React.ComponentProps<"a">) => <a data-fake-link="" {...props} />;
    const { getByRole } = render(<SectionNav groups={GROUPS} value="personal" linkComponent={Link} />);
    const link = getByRole("link", { name: "Personal" });
    expect(link).toHaveAttribute("data-fake-link");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("disables a disabled item and names the nav from labels", () => {
    const { getByRole, getByText } = render(
      <SectionNav groups={GROUPS} value="preferences" labels={{ nav: "Settings sections" }} />,
    );
    expect(getByRole("button", { name: "Documents" })).toBeDisabled();
    expect(getByRole("navigation", { name: "Settings sections" })).toBeInTheDocument();
    expect(getByText("How the app behaves")).toBeInTheDocument();
  });
});
