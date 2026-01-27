import { Box, Button, Flex, Text } from "@radix-ui/themes";
import { useCallback, useEffect, useRef, useState } from "react";
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

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clear();
    setState((prev) => ({ ...prev, isActive: false }));
  }, [clear]);

  const start = useCallback(
    (seconds?: number) => {
      clear();
      const total = seconds ?? state.totalSeconds;
      setState({
        isActive: true,
        secondsRemaining: total,
        totalSeconds: total,
      });
      intervalRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.secondsRemaining <= 1) {
            return { ...prev, secondsRemaining: 0 };
          }
          return { ...prev, secondsRemaining: prev.secondsRemaining - 1 };
        });
      }, 1000);
    },
    [clear, state.totalSeconds],
  );

  const setDuration = useCallback(
    (seconds: number) => {
      clear();
      setState({
        isActive: true,
        secondsRemaining: seconds,
        totalSeconds: seconds,
      });
      intervalRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.secondsRemaining <= 1) {
            return { ...prev, secondsRemaining: 0 };
          }
          return { ...prev, secondsRemaining: prev.secondsRemaining - 1 };
        });
      }, 1000);
    },
    [clear],
  );

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
    <Box className={`rest-timer ${isFinished ? "rest-timer--finished" : ""}`}>
      <Box
        className="rest-timer__progress"
        style={{ transform: `scaleX(${progress})` }}
      />

      <Flex
        className="rest-timer__content"
        align="center"
        justify="between"
        px="4"
        py="3"
      >
        <Flex align="center" gap="3">
          <Text size="2" weight="medium" className="rest-timer__label">
            {isFinished ? "Rest complete" : "Rest"}
          </Text>
          <Text size="5" weight="bold" className="rest-timer__countdown">
            {formatCountdown(secondsRemaining)}
          </Text>
        </Flex>

        <Flex align="center" gap="2">
          {!isFinished &&
            REST_PRESETS.map((preset) => (
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
          <Button
            size="1"
            variant="soft"
            color="gray"
            onClick={onDismiss}
            className="rest-timer__dismiss"
          >
            {isFinished ? "OK" : "Skip"}
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
}
