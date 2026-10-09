import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AuthWall } from "../src/components/auth-wall";

describe("AuthWall", () => {
  it("is an Empty with a lock, the copy and the host's action (canon parity with Rust)", () => {
    const { container, getByText, getByRole } = render(
      <AuthWall title="Sign in to view your wallet" description="Your balances live in your account.">
        <button>Sign in</button>
      </AuthWall>,
    );
    expect(container.firstElementChild).toHaveAttribute("data-slot", "empty");
    expect(container.querySelector('[data-slot="empty-icon"]')).toHaveAttribute("data-variant", "icon");
    expect(getByText("Sign in to view your wallet")).toHaveAttribute("data-slot", "empty-title");
    expect(getByRole("button", { name: "Sign in" }).parentElement).toHaveAttribute("data-slot", "empty-content");
  });
});
