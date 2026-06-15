import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "../src/components/alert-dialog";

function tree(props = {}) {
  return (
    <AlertDialog {...props}>
      <AlertDialogTrigger>open</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Title</AlertDialogTitle>
          <AlertDialogDescription>Body</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

describe("AlertDialog", () => {
  it("opens with the alertdialog role and content", () => {
    const { getByText, queryByRole, getByRole } = render(tree());
    expect(queryByRole("alertdialog")).toBeNull();
    fireEvent.click(getByText("open"));
    const dialog = getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("data-state", "open");
    expect(getByText("Title")).toBeInTheDocument();
    expect(getByText("Body")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const { getByText, queryByRole, getByRole } = render(tree());
    fireEvent.click(getByText("open"));
    expect(getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(queryByRole("alertdialog")).toBeNull();
  });

  it("closes when an action or cancel button is pressed", () => {
    const { getByText, queryByRole } = render(tree());
    fireEvent.click(getByText("open"));
    fireEvent.click(getByText("Confirm"));
    expect(queryByRole("alertdialog")).toBeNull();
  });
});
