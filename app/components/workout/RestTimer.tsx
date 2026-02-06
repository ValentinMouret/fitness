import { Button, IconButton, Text, Tooltip } from "@radix-ui/themes";
import { Bell, BellOff, BellRing } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendNotification, useNotificationPermission } from "~/notifications";
import "./RestTimer.css";

const DEFAULT_REST_SECONDS = 90;
const REST_PRESETS = [60, 90, 120, 180] as const;

interface RestTimerState {
  readonly isActive: boolean;
  readonly secondsRemaining: number;
  readonly totalSeconds: number;
}

export function useRestTimer(defaultSeconds = DEFAULT_REST_SECONDS) {
  const [state, setState] = useState<RestTimerState>({
    isActive: false,
    secondsRemaining: defaultSeconds,
    totalSeconds: defaultSeconds,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);
  const endTimeRef = useRef<number>(0);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const remaining = Math.max(
      0,
      Math.ceil((endTimeRef.current - Date.now()) / 1000),
    );
    setState((prev) => ({ ...prev, secondsRemaining: remaining }));
  }, []);

  const dismiss = useCallback(() => {
    clear();
    setState((prev) => ({ ...prev, isActive: false }));
  }, [clear]);

  const startTimer = useCallback(
    (seconds: number) => {
      clear();
      endTimeRef.current = Date.now() + seconds * 1000;
      setState({
        isActive: true,
        secondsRemaining: seconds,
        totalSeconds: seconds,
      });
      intervalRef.current = setInterval(tick, 1000);
    },
    [clear, tick],
  );

  const start = useCallback(
    (seconds?: number) => {
      startTimer(seconds ?? state.totalSeconds);
    },
    [startTimer, state.totalSeconds],
  );

  const setDuration = useCallback(
    (seconds: number) => {
      startTimer(seconds);
    },
    [startTimer],
  );

  // Recalculate immediately when the tab becomes visible again
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && intervalRef.current) {
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [tick]);

  // Notify on timer completion
  useEffect(() => {
    if (state.isActive && state.secondsRemaining === 0) {
      sendNotification("Rest Complete", {
        body: "Time for your next set!",
        icon: "/icons/icon-192.png",
        tag: "rest-timer",
      });
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [state.isActive, state.secondsRemaining]);

  useEffect(() => {
    return clear;
  }, [clear]);

  return { ...state, start, dismiss, setDuration };
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPreset(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = seconds / 60;
  return Number.isInteger(m) ? `${m}m` : `${m.toFixed(0.5)}m`;
}

const BELL_SIZE = 14;

function NotificationBell() {
  const { permission, request } = useNotificationPermission();

  if (permission === "unsupported") return null;

  if (permission === "denied") {
    return (
      <Tooltip content="Notifications blocked in browser settings">
        <IconButton size="1" variant="ghost" color="gray" disabled>
          <BellOff size={BELL_SIZE} />
        </IconButton>
      </Tooltip>
    );
  }

  if (permission === "granted") {
    return (
      <Tooltip content="Notifications enabled">
        <IconButton size="1" variant="ghost" color="gray" tabIndex={-1}>
          <BellRing size={BELL_SIZE} />
        </IconButton>
      </Tooltip>
    );
  }

  // permission === "default" — not yet asked
  return (
    <Tooltip content="Enable notifications">
      <IconButton size="1" variant="soft" onClick={request}>
        <Bell size={BELL_SIZE} />
      </IconButton>
    </Tooltip>
  );
}

interface RestTimerProps {
  readonly isActive: boolean;
  readonly secondsRemaining: number;
  readonly totalSeconds: number;
  readonly onDismiss: () => void;
  readonly onSetDuration: (seconds: number) => void;
}

export function RestTimer({
  isActive,
  secondsRemaining,
  totalSeconds,
  onDismiss,
  onSetDuration,
}: RestTimerProps) {
  if (!isActive) return null;

  const isFinished = secondsRemaining === 0;
  const progress = 1 - secondsRemaining / totalSeconds;

  return (
    <div className={`rest-timer ${isFinished ? "rest-timer--finished" : ""}`}>
      <div className="rest-timer__progress-track">
        <div
          className="rest-timer__progress-fill"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <div className="rest-timer__body">
        <div className="rest-timer__main-row">
          <div className="rest-timer__info">
            <NotificationBell />
            <Text size="1" weight="medium" className="rest-timer__label">
              {isFinished ? "Done" : "Rest"}
            </Text>
            <Text size="4" weight="bold" className="rest-timer__countdown">
              {formatCountdown(secondsRemaining)}
            </Text>
          </div>

          <Button
            size="1"
            variant={isFinished ? "solid" : "soft"}
            color={isFinished ? "green" : "gray"}
            onClick={onDismiss}
            className="rest-timer__action"
          >
            {isFinished ? "OK" : "Skip"}
          </Button>
        </div>

        {!isFinished && (
          <div className="rest-timer__presets">
            {REST_PRESETS.map((preset) => (
              <Button
                key={preset}
                size="1"
                variant={preset === totalSeconds ? "solid" : "soft"}
                className="rest-timer__preset"
                onClick={() => onSetDuration(preset)}
              >
                {formatPreset(preset)}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
