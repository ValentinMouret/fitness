import { redirect } from "react-router";
import { getAuthFoundation } from "~/modules/auth/infra/auth-foundation.server";
import {
  logoutUser,
  requireSameOrigin,
} from "~/modules/auth/infra/session.server";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  const runtime = getAuthFoundation();
  if (runtime) {
    requireSameOrigin(request);
    const response = await runtime.auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });
    return redirect("/sign-in", { headers: response.headers });
  }
  return logoutUser(request);
}

export function loader() {
  return redirect("/dashboard");
}
