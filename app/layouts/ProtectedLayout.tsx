import { Outlet } from "react-router";
import type { Route } from "./+types/ProtectedLayout";
import { requireAuth } from "~/auth";

export async function loader({ request }: Route.LoaderArgs) {
  const user = requireAuth(request);
  return { user };
}

export default function ProtectedLayout() {
  return <Outlet />;
}
