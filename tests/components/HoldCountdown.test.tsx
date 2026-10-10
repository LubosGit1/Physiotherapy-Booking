// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoldCountdown } from "@/components/booking/HoldCountdown";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const NOW = new Date("2030-03-04T07:00:00Z");

describe("HoldCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    refresh.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("counts down every second", () => {
    render(<HoldCountdown expiresAt="2030-03-04T07:10:00Z" />);
    expect(screen.getByRole("timer")).toHaveTextContent("10:00left to confirm");

    act(() => vi.advanceTimersByTime(61_000));
    expect(screen.getByRole("timer")).toHaveTextContent("8:59");
  });

  it("asks the server for the expired state once the time is up", () => {
    render(<HoldCountdown expiresAt="2030-03-04T07:00:03Z" />);
    act(() => vi.advanceTimersByTime(3_000));

    expect(screen.getByRole("timer")).toHaveTextContent("0:00Your hold has run out");
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(5_000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
