import { useState, useEffect } from "react";
import { formatStartedAgo } from "~/time";

interface UseLiveDurationProps {
  readonly startTime: Date;
  readonly endTime?: Date;
}

export function useLiveDuration({ startTime, endTime }: UseLiveDurationProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (endTime) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  const totalSeconds = Math.floor(
    ((endTime || currentTime).getTime() - startTime.getTime()) / 1000,
  );
  const duration = Math.floor(totalSeconds / 60);

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  };

  const formatTimer = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  return {
    duration,
    formattedDuration: formatDuration(duration),
    formattedTimer: formatTimer(totalSeconds),
    startedAgo: formatStartedAgo(duration),
  };
}
