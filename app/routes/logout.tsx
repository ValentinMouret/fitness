import type { Route } from "./+types/logout";
import { logoutUser } from "~/modules/auth/application/auth.service.server";

export async function action(_: Route.ActionArgs) {
  return logoutUser();
}

export async function loader() {
  return logoutUser();
}
