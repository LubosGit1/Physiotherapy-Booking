"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/** Counts down the hold; when it runs out the page re-renders from the server, which shows the expired state. */
export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const deadline = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => deadline - Date.now());
  const refreshed = useRef(false);

  useEffect(() => {
    const tick = () => {
      const left = deadline - Date.now();
      setRemaining(left);
      // Guarded so a re-render can never trigger a second refresh.
      if (left <= 0 && !refreshed.current) {
        refreshed.current = true;
        router.refresh();
      }
      return left;
    };
    const timer = setInterval(() => {
      if (tick() <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline, router]);

  const expired = remaining <= 0;
  return (
    <div role="timer" data-cy="hold-countdown" className="flex items-baseline gap-3">
      <span suppressHydrationWarning className={`text-6xl font-extrabold tabular-nums ${expired ? "text-danger" : ""}`}>
        {formatRemaining(remaining)}
      </span>
      <span className="text-muted">{expired ? "Your hold has run out" : "left to confirm"}</span>
    </div>
  );
}
