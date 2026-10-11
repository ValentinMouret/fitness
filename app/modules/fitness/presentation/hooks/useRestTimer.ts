import { useCallback, useEffect, useState } from "react";
import { sendNotification } from "~/notifications";
import {
  adjustRest,
  applyPreset,
  DEFAULT_REST_SECONDS,
  REST_OVER_DISMISS_MS,
  type Rest,
} from "../rest-timer/rest-timer";

const STORAGE_KEY = "rest-timer-duration";

function loadDefaultSeconds(): number {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_REST_SECONDS;
  } catch {
    return DEFAULT_REST_SECONDS;
  }
}

function saveDefaultSeconds(seconds: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(seconds));
  } catch {
    // The preset still applies to the running rest.
  }
}

export interface RestTimer {
  readonly rest: Rest | null;
  /** The rest length used when the next one starts. */
  readonly defaultSeconds: number;
  readonly start: (seconds: number, source?: string) => void;
  readonly adjust: (seconds: number) => void;
  /** Applies a preset to the running rest and remembers it for the next. */
  readonly choosePreset: (seconds: number) => void;
  readonly dismiss: () => void;
  /** Ends the rest only if the given source started it. */
  readonly cancel: (source: string) => void;
}

/** Client-side rest countdown that notifies when the rest is over. */
export function useRestTimer(): RestTimer {
  const [rest, setRest] = useState<Rest | null>(null);
  const [defaultSeconds, setDefaultSeconds] = useState(DEFAULT_REST_SECONDS);

  useEffect(() => setDefaultSeconds(loadDefaultSeconds()), []);

  // Notify when the rest ends, then dismiss the "rest over" state shortly after.
  useEffect(() => {
    if (!rest) return;
    const endsIn = rest.startedAt + rest.durationMs - Date.now();
    const notify = setTimeout(
      () => {
        sendNotification("Rest complete", {
          body: "Time for your next set!",
          icon: "/icons/icon-192.png",
          tag: "rest-timer",
        });
        navigator.vibrate?.([200, 100, 200]);
      },
      Math.max(0, endsIn),
    );
    const dismiss = setTimeout(
      () => setRest(null),
      Math.max(0, endsIn) + REST_OVER_DISMISS_MS,
    );
    return () => {
      clearTimeout(notify);
      clearTimeout(dismiss);
    };
  }, [rest]);

  const start = useCallback(
    (seconds: number, source?: string) =>
      setRest({ startedAt: Date.now(), durationMs: seconds * 1000, source }),
    [],
  );

  const adjust = useCallback(
    (seconds: number) =>
      setRest((current) =>
        current ? adjustRest(current, seconds, Date.now()) : current,
      ),
    [],
  );

  const choosePreset = useCallback((seconds: number) => {
    saveDefaultSeconds(seconds);
    setDefaultSeconds(seconds);
    setRest((current) =>
      current ? applyPreset(current, seconds, Date.now()) : current,
    );
  }, []);

  const dismiss = useCallback(() => setRest(null), []);

  const cancel = useCallback(
    (source: string) =>
      setRest((current) => (current?.source === source ? null : current)),
    [],
  );

  return {
    rest,
    defaultSeconds,
    start,
    adjust,
    choosePreset,
    dismiss,
    cancel,
  };
}
