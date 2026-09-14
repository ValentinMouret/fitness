import { Outlet } from "react-router";
import { requireAuth } from "~/modules/auth/infra/session.server";
import type { Route } from "./+types/ProtectedLayout";

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request }, next) => {
    await requireAuth(request);
    return next();
  },
];

export function loader() {
  return null;
}

export default function ProtectedLayout() {
  return <Outlet />;
}
