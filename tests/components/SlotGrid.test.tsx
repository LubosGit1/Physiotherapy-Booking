// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SlotGrid } from "@/components/booking/SlotGrid";
import { holdSlotAction } from "@/server/actions/booking";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/server/actions/booking", () => ({ holdSlotAction: vi.fn() }));
const hold = vi.mocked(holdSlotAction);

const slots = [
  { startsAt: "2030-03-05T09:00:00.000Z", therapistId: "emma", therapistName: "Emma Hart" },
  { startsAt: "2030-03-05T09:15:00.000Z", therapistId: "mark", therapistName: "Mark Cole" },
];

const renderGrid = (showTherapist = true) =>
  render(<SlotGrid serviceId="svc" slots={slots} showTherapist={showTherapist} currentUrl="/book?service=svc" />);

describe("SlotGrid", () => {
  beforeEach(() => {
    hold.mockReset();
    push.mockReset();
    refresh.mockReset();
  });

  it("labels each time in clinic time with the therapist", () => {
    renderGrid();
    expect(screen.getByRole("button", { name: "10:00 with Emma Hart" })).toBeInTheDocument();
    expect(screen.getByText("Mark Cole")).toBeInTheDocument();
  });

  it("hides therapist names when one therapist is already chosen", () => {
    renderGrid(false);
    expect(screen.queryByText("Mark Cole")).not.toBeInTheDocument();
  });

  it("holds the slot and opens the confirmation page", async () => {
    hold.mockResolvedValue({ ok: true, data: { appointmentId: "appt-1" } });
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: /10:00/ }));

    expect(hold).toHaveBeenCalledWith({
      serviceId: "svc",
      therapistId: "emma",
      startsAt: "2030-03-05T09:00:00.000Z",
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(push).toHaveBeenCalledWith("/book/hold/appt-1");
  });

  it("sends signed-out visitors to sign in and back", async () => {
    hold.mockResolvedValue({ ok: false, error: "Sign in to book.", needsSignIn: true });
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: /10:00/ }));
    expect(push).toHaveBeenCalledWith("/login?callbackUrl=%2Fbook%3Fservice%3Dsvc");
  });

  it("shows a conflict, refreshes the list and reuses the idempotency key on retry", async () => {
    hold.mockResolvedValueOnce({ ok: false, error: "Someone has just booked that time. Pick another slot." });
    hold.mockResolvedValueOnce({ ok: true, data: { appointmentId: "appt-2" } });
    renderGrid();

    const button = screen.getByRole("button", { name: /10:00/ });
    await userEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Someone has just booked that time.");
    expect(refresh).toHaveBeenCalled();

    await userEvent.click(button);
    const [first, second] = hold.mock.calls.map(([input]) => input.idempotencyKey);
    expect(second).toBe(first);
  });

  it("explains a network failure and lets the user try again", async () => {
    hold.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: /10:00/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't reach the clinic");
    await waitFor(() => expect(screen.getByRole("button", { name: /10:00/ })).toBeEnabled());
  });

  it("ignores a second click while the first is in flight", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof holdSlotAction>>) => void;
    hold.mockReturnValue(new Promise((r) => (resolve = r)));
    renderGrid();

    const button = screen.getByRole("button", { name: /10:00/ });
    await userEvent.dblClick(button);
    expect(hold).toHaveBeenCalledTimes(1);
    resolve({ ok: true, data: { appointmentId: "appt-3" } });
  });
});
