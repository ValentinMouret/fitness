import { useEffect } from "react";
import { replace, useRevalidator } from "react-router";
import { toLocalDateString } from "~/time";

export async function loadDeviceDay<T>(input: {
  readonly request: Request;
  readonly serverLoader: () => Promise<T>;
}): Promise<T> {
  const url = new URL(input.request.url);
  const day = toLocalDateString(new Date());
  if (url.searchParams.get("day") !== day) {
    url.searchParams.set("day", day);
    throw replace(`${url.pathname}${url.search}`);
  }
  return input.serverLoader();
}

export function useDeviceDayRollover(day: string): void {
  const revalidator = useRevalidator();
  useEffect(() => {
    function refreshDay() {
      if (toLocalDateString(new Date()) !== day && revalidator.state === "idle")
        void revalidator.revalidate();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") refreshDay();
    }
    refreshDay();
    const now = new Date();
    const midnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const timer = window.setTimeout(
      refreshDay,
      midnight.getTime() - now.getTime(),
    );
    window.addEventListener("focus", refreshDay);
    window.addEventListener("pageshow", refreshDay);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshDay);
      window.removeEventListener("pageshow", refreshDay);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [day, revalidator]);
}
