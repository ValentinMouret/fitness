import { logoutUser } from "~/modules/auth/application/auth.service.server";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  return logoutUser(request);
}

export async function loader({ request }: Route.LoaderArgs) {
  return logoutUser(request);
}
