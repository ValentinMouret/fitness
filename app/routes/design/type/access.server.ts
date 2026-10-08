import { env } from "~/env.server";

export function requireDesignPreview() {
  if (!import.meta.env.DEV && env.PREVIEW_APP !== "true") {
    throw new Response("Not found", { status: 404 });
  }
}
