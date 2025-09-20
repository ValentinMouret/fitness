import { redirect } from "react-router";
import type { Route } from "./+types/logout";

export async function action(_: Route.ActionArgs) {
  // Clear cookie by setting it to expire in the past
  const clearCookie = "fitness-rr-session=; Path=/; Max-Age=0; SameSite=Strict";

  return redirect("/login", {
    headers: {
      "Set-Cookie": clearCookie,
    },
  });
}

export async function loader() {
  // Clear cookie by setting it to expire in the past
  const clearCookie = "fitness-rr-session=; Path=/; Max-Age=0; SameSite=Strict";

  return redirect("/login", {
    headers: {
      "Set-Cookie": clearCookie,
    },
  });
}
