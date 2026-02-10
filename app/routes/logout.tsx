import { logoutUser } from "~/modules/auth/application/auth.service.server";
import type { Route } from "./+types/logout";

export async function action(_: Route.ActionArgs) {
  return logoutUser();
}

export async function loader() {
  return logoutUser();
}
