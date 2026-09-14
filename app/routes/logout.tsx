import { redirect } from "react-router";
import { logoutUser } from "~/modules/auth/infra/session.server";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  return logoutUser(request);
}

export function loader() {
  return redirect("/dashboard");
}
