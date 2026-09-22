import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../src/components/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../src/components/select";
import { Portal, PortalProvider } from "../src/primitives/portal";

// A brand scope with its own overlay root inside it, the way a consumer wires it.
function Branded({ children }: { children: React.ReactNode }) {
  const [root, setRoot] = React.useState<HTMLDivElement | null>(null);
  return (
    <section data-brand="second">
      <PortalProvider container={root}>{children}</PortalProvider>
      <div data-testid="overlay-root" ref={setRoot} />
    </section>
  );
}

describe("PortalProvider", () => {
  it("mounts a Dialog opened beneath it inside the brand scope", () => {
    const { getByText, getByRole, getByTestId } = render(
      <Branded>
        <Dialog>
          <DialogTrigger>open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      </Branded>,
    );
    fireEvent.click(getByText("open"));
    const dialog = getByRole("dialog");
    expect(getByTestId("overlay-root")).toContainElement(dialog);
    expect(dialog.closest("[data-brand]")).toHaveAttribute("data-brand", "second");
  });

  it("mounts a Select's list inside the brand scope", () => {
    const { getByRole, getByTestId } = render(
      <Branded>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Pick" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Apple</SelectItem>
          </SelectContent>
        </Select>
      </Branded>,
    );
    fireEvent.click(getByRole("combobox"));
    expect(getByTestId("overlay-root")).toContainElement(getByRole("listbox"));
  });

  it("falls back to document.body while the container is not mounted yet", () => {
    const { getByText } = render(
      <PortalProvider container={null}>
        <Portal>
          <span>floating</span>
        </Portal>
      </PortalProvider>,
    );
    expect(getByText("floating").parentElement).toBe(document.body);
  });

  it("yields to an explicit container", () => {
    const own = document.createElement("div");
    document.body.append(own);
    const { getByText } = render(
      <PortalProvider container={document.body}>
        <Portal container={own}>
          <span>floating</span>
        </Portal>
      </PortalProvider>,
    );
    expect(getByText("floating").parentElement).toBe(own);
    own.remove();
  });
});
