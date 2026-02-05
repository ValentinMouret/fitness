import { useCallback, useEffect, useState } from "react";

type Permission = NotificationPermission | "unsupported";

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function getPermission(): Permission {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

async function requestPermission(): Promise<Permission> {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.requestPermission();
}

export async function sendNotification(
  title: string,
  options?: NotificationOptions,
): Promise<void> {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== "granted") return;

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // Fall through to basic notification
  }

  new Notification(title, options);
}

/** Tracks browser notification permission reactively. SSR-safe. */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<Permission>("unsupported");

  useEffect(() => {
    setPermission(getPermission());
  }, []);

  const request = useCallback(async () => {
    const result = await requestPermission();
    if (result !== "unsupported") {
      setPermission(result);
    }
  }, []);

  return { permission, request } as const;
}
