import { Outlet } from "react-router";
import { requireAuth } from "~/auth";
import type { Route } from "./+types/ProtectedLayout";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  return { user };
}

export default function ProtectedLayout() {
  return <Outlet />;
}
