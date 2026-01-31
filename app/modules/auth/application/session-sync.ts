import { SESSION_COOKIE_NAME } from "../domain/session";

export function syncSessionFromCookie(): null {
  if (typeof window === "undefined") {
    return null;
  }

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split("=");
    if (key === SESSION_COOKIE_NAME && value) {
      try {
        const user = JSON.parse(decodeURIComponent(value));
        sessionStorage.setItem("fitness-rr-auth", JSON.stringify(user));
      } catch {
        // Invalid cookie data, ignore
      }
      break;
    }
  }

  return null;
}
