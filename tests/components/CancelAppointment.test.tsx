// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CancelAppointment } from "@/components/booking/CancelAppointment";
import { cancelAppointmentAction } from "@/server/actions/booking";

vi.mock("@/server/actions/booking", () => ({ cancelAppointmentAction: vi.fn() }));
const cancel = vi.mocked(cancelAppointmentAction);

describe("CancelAppointment", () => {
  beforeEach(() => cancel.mockReset());

  it("explains why cancelling isn't possible", () => {
    render(<CancelAppointment appointmentId="a1" allowed={false} reason="Call the clinic to cancel this one." />);
    const button = screen.getByRole("button", { name: "Cancel appointment" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Call the clinic to cancel this one.");
  });

  it("asks for confirmation before cancelling", async () => {
    cancel.mockResolvedValue({ ok: true, data: undefined });
    render(<CancelAppointment appointmentId="a1" allowed />);

    await userEvent.click(screen.getByRole("button", { name: "Cancel appointment" }));
    expect(cancel).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Yes, cancel it" }));
    expect(cancel).toHaveBeenCalledWith("a1");
  });

  it("can back out", async () => {
    render(<CancelAppointment appointmentId="a1" allowed />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel appointment" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.getByRole("button", { name: "Cancel appointment" })).toBeInTheDocument();
  });

  it("shows the server's reason when it refuses", async () => {
    cancel.mockResolvedValue({ ok: false, error: "Only confirmed appointments can be cancelled." });
    render(<CancelAppointment appointmentId="a1" allowed />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel appointment" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, cancel it" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only confirmed appointments can be cancelled.");
  });
});
