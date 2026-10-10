// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RegisterForm } from "@/components/forms/AuthForms";
import { registerAction } from "@/server/actions/auth";

vi.mock("@/server/actions/auth", () => ({ loginAction: vi.fn(), registerAction: vi.fn() }));

describe("RegisterForm", () => {
  it("keeps what the user typed when the server rejects the form", async () => {
    vi.mocked(registerAction).mockResolvedValue({
      error: "Use at least 8 characters for your password.",
      values: { name: "Petra Lane", email: "petra@example.com" },
    });
    render(<RegisterForm callbackUrl="/book?service=1" />);

    await userEvent.type(screen.getByLabelText("Full name"), "Petra Lane");
    await userEvent.type(screen.getByLabelText("Email"), "petra@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Use at least 8 characters");
    expect(screen.getByLabelText("Full name")).toHaveValue("Petra Lane");
    expect(screen.getByLabelText("Email")).toHaveValue("petra@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("");

    const formData = vi.mocked(registerAction).mock.calls[0][1];
    expect(formData.get("callbackUrl")).toBe("/book?service=1");
  });
});
