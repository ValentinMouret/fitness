import { getAuthFoundation } from "~/modules/auth/infra/auth-foundation.server";
import type { Route } from "./+types/auth";

async function handle(request: Request) {
  const runtime = getAuthFoundation();
  if (!runtime) throw new Response("Not found", { status: 404 });
  const response = await runtime.auth.handler(request);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export function loader({ request }: Route.LoaderArgs) {
  return handle(request);
}
export function action({ request }: Route.ActionArgs) {
  return handle(request);
}
