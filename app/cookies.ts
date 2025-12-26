import { isServer } from "./utils";

async function getCookie(
  name: string,
  cookieString?: string,
): Promise<string | null> {
  if (isServer() && !cookieString) {
    return null;
  }

  if (cookieString) {
    const cookies = cookieString.split(";");
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split("=");
      if (key === name) {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  const cookie = await cookieStore.get(name);
  return cookie?.value ?? null;
}

async function setCookie(name: string, value: string, days = 7): Promise<void> {
  if (isServer()) {
    return;
  }

  await cookieStore.set({
    name,
    value: encodeURIComponent(value),
    expires: Date.now() + days * 24 * 60 * 60 * 1000,
    path: "/",
    sameSite: "strict",
  });
}

async function deleteCookie(name: string): Promise<void> {
  if (isServer()) return;

  await cookieStore.delete(name);
}

export const Cookies = { set: setCookie, get: getCookie, delete: deleteCookie };
