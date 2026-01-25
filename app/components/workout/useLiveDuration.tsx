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

  const duration = Math.floor(
    ((endTime || currentTime).getTime() - startTime.getTime()) / 1000 / 60,
  );

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

  return {
    duration,
    formattedDuration: formatDuration(duration),
    startedAgo: formatStartedAgo(duration),
  };
}
