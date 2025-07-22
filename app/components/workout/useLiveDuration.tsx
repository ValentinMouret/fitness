import { useState, useEffect } from "react";

interface UseLiveDurationProps {
  readonly startTime: Date;
  readonly endTime?: Date;
}

export function useLiveDuration({ startTime, endTime }: UseLiveDurationProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // If the workout is completed (has endTime), no need to update
    if (endTime) {
      return;
    }

    // Update current time every second
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  // Calculate duration in minutes
  const duration = Math.floor(
    ((endTime || currentTime).getTime() - startTime.getTime()) / 1000 / 60,
  );

  // Format duration as "Xm" or "Xh Ym" for longer workouts
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
  };
}
